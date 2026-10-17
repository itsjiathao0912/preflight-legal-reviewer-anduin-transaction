import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineResult } from '../src/engine/types';

// Review Major 1 (intake S4): a package re-open of the document the AI lane holds keeps the lane
// (no abort of the call in flight, no status reset); a lane that holds nothing runs classic.
const h = vi.hoisted(() => ({
  calls: [] as { signal: AbortSignal; resolve: (t: unknown) => void }[],
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
  verifyAiInWorker: async () => ({
    ok: true,
    findings: [],
    rejected: [],
    rulesApplied: 0,
    rulesTotal: 0,
  }),
}));
vi.mock('../src/features/ai/precomputed', () => ({ loadPrecomputed: async () => null }));
vi.mock('../src/features/ai/stream-client', () => ({
  requestAi: (call: { signal: AbortSignal }) =>
    new Promise((resolve) => {
      h.calls.push({ signal: call.signal, resolve });
      call.signal.addEventListener('abort', () => resolve({ kind: 'aborted' }));
    }),
}));

const lane = await import('../src/features/ai/ai-lane');
const { useSession } = await import('../src/state/session');

const HASH = 'a'.repeat(64);
const result = {
  docHash: HASH,
  failedStage: null,
  aiCandidates: [{ id: 'c1' }],
} as unknown as EngineResult;
const doc = { id: HASH, docHash: HASH, source: 'upload' as const, firmId: null };
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  h.calls = [];
  useSession.setState({ aiOn: true, readOnly: false });
  lane.aiBeginOpen();
});

describe('ai-lane: package re-open keeps the lane (review Major 1)', () => {
  it('a setRole re-open with AI pending keeps the in-flight call and the status', async () => {
    const r = await lane.aiOnOpen(new Uint8Array(1), result, doc);
    expect(r.fresh).toBe(true);
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    expect(lane.useAiLane.getState().status).toBe('pending');
    // the re-open path: review.openDocument skips aiBeginOpen and calls aiReopen
    expect(lane.aiHolds(HASH)).toBe(true);
    const kept = lane.aiReopen(new Uint8Array(2), result);
    expect(kept).toEqual({ findings: [], fresh: false });
    await flush();
    expect(h.calls[0]!.signal.aborted).toBe(false);
    expect(lane.useAiLane.getState().status).toBe('pending');
    expect(h.calls).toHaveLength(1); // no second call
    h.calls[0]!.resolve({ kind: 'result', resultKind: 'ai', data: {}, cache: 'hit', model: 'm' });
    await vi.waitFor(() => expect(lane.useAiLane.getState().status).toBe('cache'));
  });

  it('a lane that holds nothing (restore after reload) is never left pending without a call', async () => {
    expect(lane.aiHolds(HASH)).toBe(false);
    expect(lane.aiReopen(new Uint8Array(1), result)).toBeNull();
    const r = await lane.aiOnOpen(new Uint8Array(1), result, doc);
    expect(lane.useAiLane.getState().status).toBe('pending');
    expect(r.fresh).toBe(true); // review then runs aiRunFresh, exactly like a classic restore
    void lane.aiRunFresh();
    await vi.waitFor(() => expect(h.calls).toHaveLength(1));
    expect(h.calls[0]!.signal.aborted).toBe(false);
  });

  it('another document is not held: aiReopen refuses it', async () => {
    await lane.aiOnOpen(new Uint8Array(1), result, doc);
    const other = { ...result, docHash: 'b'.repeat(64) } as EngineResult;
    expect(lane.aiHolds(other.docHash)).toBe(false);
    expect(lane.aiReopen(new Uint8Array(1), other)).toBeNull();
  });
});
