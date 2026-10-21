import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineResult } from '../src/engine/types';

// llm-defect-detection (AC8-web): the lane sends a second /api/ai call with task reference-target
// when the engine built pairs, runs on pairs alone, verifies with the task (pair sites), merges
// both calls, and keeps call-1 findings with a partial notice when call 2 fails.
type Call = { task?: string; candidates: { id: string }[]; resolve: (t: unknown) => void };
const h = vi.hoisted(() => ({
  calls: [] as Call[],
  verifyCtx: [] as { task?: string }[],
}));
vi.mock('../src/api/base', () => ({
  apiBase: () => 'https://x.workers.dev',
  apiEnabled: () => true,
  onApiBaseChange: () => () => undefined,
}));
vi.mock('../src/api/client', () => ({ memoryApi: () => null }));
vi.mock('../src/engine/client', () => ({
  analyzeInWorker: async () => undefined,
  rulesHash8InWorker: async () => 'none',
  verifyAiInWorker: async (
    data: { id: string },
    _d: string,
    _r: string[],
    ctx: { task?: string },
  ) => {
    h.verifyCtx.push(ctx);
    return { ok: true, findings: [{ id: data.id }], rejected: [], rulesApplied: 0, rulesTotal: 0 };
  },
}));
vi.mock('../src/features/ai/precomputed', () => ({ loadPrecomputed: async () => null }));
vi.mock('../src/features/ai/stream-client', () => ({
  requestAi: (call: Call & { signal: AbortSignal }) =>
    new Promise((resolve) => {
      h.calls.push({ task: call.task, candidates: call.candidates, resolve });
      call.signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
    }),
}));

const lane = await import('../src/features/ai/ai-lane');
const { useSession } = await import('../src/state/session');

const HASH = 'a'.repeat(64);
const mk = (cands: number, pairs: number) =>
  ({
    docHash: HASH,
    failedStage: null,
    aiCandidates: Array.from({ length: cands }, (_, i) => ({ id: `c${i}` })),
    pairs: Array.from({ length: pairs }, (_, i) => ({ id: `r${i}` })),
  }) as unknown as EngineResult;
const doc = { id: HASH, docHash: HASH, source: 'upload' as const, firmId: null };
const ok = (id: string) => ({
  kind: 'result',
  resultKind: 'ai',
  data: { id },
  cache: 'miss',
  model: 'm',
});
let shown: { id: string }[] = [];

beforeEach(() => {
  h.calls = [];
  h.verifyCtx = [];
  shown = [];
  lane.setAiSink((_d, f) => {
    shown = f as unknown as { id: string }[];
  });
  useSession.setState({
    aiOn: true,
    readOnly: false,
    refreshQuota: async () => undefined,
  } as never);
  lane.aiBeginOpen();
});

describe('ai-lane reference-target second call (AC8-web)', () => {
  it('sends call 2 with task reference-target and merges both verified results', async () => {
    await lane.aiOnOpen(new Uint8Array(1), mk(2, 1), doc);
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    expect(h.calls[0]!.task).toBeUndefined(); // clause-judgment (default)
    h.calls[0]!.resolve(ok('f1'));
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    expect(h.calls[1]!.task).toBe('reference-target');
    expect(h.calls[1]!.candidates.map((c) => c.id)).toEqual(['r0']);
    h.calls[1]!.resolve(ok('f2'));
    await vi.waitFor(() => expect(lane.useAiLane.getState().status).toBe('fresh'));
    expect(lane.useAiLane.getState().count).toBe(2);
    expect(lane.useAiLane.getState().note).toBeNull();
    expect(shown.map((f) => f.id)).toEqual(['f1', 'f2']);
    expect(h.verifyCtx.map((c) => c.task)).toEqual([undefined, 'reference-target']);
  });

  it('runs on pairs alone when clause-judgment candidates are 0 (both guards)', async () => {
    const r = await lane.aiOnOpen(new Uint8Array(1), mk(0, 2), doc);
    expect(r.fresh).toBe(true);
    expect(lane.useAiLane.getState().status).toBe('pending');
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    expect(h.calls[0]!.task).toBe('reference-target');
    h.calls[0]!.resolve(ok('p1'));
    await vi.waitFor(() => expect(lane.useAiLane.getState().status).toBe('fresh'));
    expect(shown.map((f) => f.id)).toEqual(['p1']);
  });

  it('skips when there are neither candidates nor pairs', async () => {
    await lane.aiOnOpen(new Uint8Array(1), mk(0, 0), doc);
    expect(lane.useAiLane.getState().status).toBe('skipped');
    await lane.aiRunFresh();
    expect(h.calls).toHaveLength(0);
  });

  it('call-2 failure keeps call-1 findings with the partial notice and no retry', async () => {
    await lane.aiOnOpen(new Uint8Array(1), mk(1, 1), doc);
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.calls[0]!.resolve(ok('f1'));
    await vi.waitFor(() => expect(h.calls).toHaveLength(2));
    h.calls[1]!.resolve({ kind: 'error', error: { code: 'quota_exceeded', retryAfterS: 60 } });
    await vi.waitFor(() => expect(lane.useAiLane.getState().note).toBe(lane.PARTIAL_NOTICE));
    const s = lane.useAiLane.getState();
    expect(s.status).toBe('fresh');
    expect(s.banner).toBeNull();
    expect(s.resetAt).toBeNull();
    expect(s.count).toBe(1);
    expect(shown.map((f) => f.id)).toEqual(['f1']);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.calls).toHaveLength(2);
  });

  it('call-1 failure downgrades as before and call 2 is not sent', async () => {
    await lane.aiOnOpen(new Uint8Array(1), mk(1, 1), doc);
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    h.calls[0]!.resolve({
      kind: 'result',
      resultKind: 'other',
      data: {},
      cache: 'miss',
      model: 'm',
    });
    await vi.waitFor(() => expect(lane.useAiLane.getState().banner).toBe('result_unusable'));
    expect(h.calls).toHaveLength(1);
  });
});
