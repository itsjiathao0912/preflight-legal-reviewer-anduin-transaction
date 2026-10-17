import 'fake-indexeddb/auto';
import type { IssueClass } from '@aduin/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoryApi } from '../src/api/memoryApi';
import { RealMemoryApi } from '../src/api/realMemoryApi';
import type { FindingView } from '../src/engine/types';
import { createFakeMemoryFetch } from './support/fakeMemoryFetch';

// Phase 10 EVL fix: opening a firm document must never wait on the Turnstile-gated memory session.
// Deterministic findings render first (labels New, no network); memory and AI arrive later. A
// failed verification is cached (one challenge for N memory calls) and a background trigger never
// shows the interactive challenge overlay.

const h = vi.hoisted(() => ({
  api: null as MemoryApi | null,
  analyze: null as unknown,
}));
vi.mock('../src/api/client', async () => {
  const real = await import('../src/api/realMemoryApi');
  return {
    memoryApi: () => h.api,
    isRealMemoryApi: (a: unknown) => a instanceof real.RealMemoryApi,
  };
});
vi.mock('../src/engine/client', () => ({
  analyzeInWorker: async () => h.analyze,
  rememberInput: () => undefined,
}));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  // the AI lane's firm-rules read sits behind the same session; it must not hold the list either
  aiOnOpen: () => new Promise(() => undefined),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { useReview } = await import('../src/state/review');
const { resetMemorySyncForTest } = await import('../src/state/memory-sync');
const turnstile = await import('../src/features/ai/turnstile');
const { createTurnstileProvider } = await import('../src/features/ai/turnstile-widget');

const FIRM = 'partners-group';
const DOC_HASH = 'd'.repeat(64);

function finding(id: string): FindingView {
  return {
    id,
    issue_class: 'broken_cross_reference' as IssueClass,
    severity: 'critical',
    detector_kind: 'rule',
    detector_id: 'XREF-02',
    confidence: 0.9,
    anchor: { blockId: 'b1', offsetStart: 0, offsetEnd: 10 },
    section_path: ['Section 1'],
    quote_snippet: `See Part ${id} of Section 6.`,
    quote_hash: 'e'.repeat(64),
    detail: { explanation: 'x', facts: {}, interpretations: [] },
    quote: `See Part ${id} of Section 6.`,
    classLabel: 'Broken cross-reference',
    title: `Finding ${id}`,
    ref: '§1',
    loc: 'Section 1',
    found: null,
    sensitive: [],
    order: 1,
  } as unknown as FindingView;
}

const meta = {
  name: 'PG NGI 2026',
  firmId: FIRM,
  firmName: 'Partners Group',
  fund: 'Next Generation Infrastructure',
  version: '2026',
  source: 'sample' as const,
  ref: '05',
};
const HTML = new TextEncoder().encode('<p>x</p>');

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  resetMemorySyncForTest();
  turnstile.resetUserIntentForTest();
  h.analyze = {
    failedStage: null,
    docHash: DOC_HASH,
    findings: [finding('A'), finding('B')],
    blocks: [],
    stages: [],
    aiCandidates: [],
  };
});
afterEach(() => {
  h.api = null;
  document.getElementById('aduin-turnstile')?.remove();
});

describe('turnstile-no-block: firm document open', () => {
  it('renders deterministic findings at once while the verification never resolves', async () => {
    const token = vi.fn(() => new Promise<string | null>(() => undefined));
    const fake = createFakeMemoryFetch();
    h.api = new RealMemoryApi({
      fetch: fake.fetch,
      turnstileToken: token,
      turnstileRequired: () => true,
    });
    void useReview.getState().openDocument(HTML, meta);
    await vi.waitFor(() => expect(useReview.getState().phase).toBe('ready'), { timeout: 500 });
    const s = useReview.getState();
    expect(s.result?.findings.map((f) => f.id)).toEqual(['A', 'B']);
    expect(Object.values(s.memory!.byId).map((m) => m.label)).toEqual(['new', 'new']);
    expect(s.memory!.unavailable).toBe(false);
    expect(s.memory!.pending).toBe(true);
    expect(fake.calls).toHaveLength(0); // no POST /api/session without a token (E24)
  });

  it('applies the memory lookup once the session arrives (late update)', async () => {
    const d = deferred<string | null>();
    const fake = createFakeMemoryFetch();
    h.api = new RealMemoryApi({
      fetch: fake.fetch,
      turnstileToken: () => d.promise,
      turnstileRequired: () => true,
    });
    void useReview.getState().openDocument(HTML, meta);
    await vi.waitFor(() => expect(useReview.getState().phase).toBe('ready'), { timeout: 500 });
    const before = useReview.getState().memory;
    d.resolve('tok');
    await vi.waitFor(() =>
      expect(fake.calls.some((c) => c.path === '/api/memory/lookup')).toBe(true),
    );
    await vi.waitFor(() => expect(useReview.getState().memory).not.toBe(before));
    expect(useReview.getState().memory!.unavailable).toBe(false);
    expect(useReview.getState().phase).toBe('ready');
    expect(useReview.getState().memory!.pending).toBeUndefined();
  });

  it('a failed verification shows Memory unavailable and is not re-run per call', async () => {
    const token = vi.fn(async () => null);
    const fake = createFakeMemoryFetch();
    h.api = new RealMemoryApi({
      fetch: fake.fetch,
      turnstileToken: token,
      turnstileRequired: () => true,
    });
    void useReview.getState().openDocument(HTML, meta);
    await vi.waitFor(() => expect(useReview.getState().memory?.unavailable).toBe(true));
    expect(token).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('turnstile-no-block: cached bootstrap failure', () => {
  it('one challenge for N memory calls; user intent clears the cache', async () => {
    const token = vi.fn(async () => null);
    const fake = createFakeMemoryFetch();
    const api = new RealMemoryApi({
      fetch: fake.fetch,
      turnstileToken: token,
      turnstileRequired: () => true,
    });
    for (let i = 0; i < 3; i++) {
      await expect(api.lookup(FIRM, ['a'.repeat(64)])).rejects.toMatchObject({
        code: 'unauthorized',
      });
    }
    await expect(api.firmRules(FIRM)).rejects.toMatchObject({ code: 'unauthorized' });
    expect(token).toHaveBeenCalledTimes(1);
    api.clearBootFailure();
    await expect(api.lookup(FIRM, ['a'.repeat(64)])).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(token).toHaveBeenCalledTimes(2);
    expect(fake.calls).toHaveLength(0);
  });

  it('the cached failure expires after the TTL', async () => {
    let now = 1_000_000;
    const token = vi.fn(async () => null);
    const api = new RealMemoryApi({
      fetch: createFakeMemoryFetch().fetch,
      now: () => now,
      turnstileToken: token,
      turnstileRequired: () => true,
    });
    await expect(api.bootstrap('Linh Tran')).rejects.toBeTruthy();
    await expect(api.bootstrap('Linh Tran')).rejects.toBeTruthy();
    expect(token).toHaveBeenCalledTimes(1);
    now += 60_001;
    await expect(api.bootstrap('Linh Tran')).rejects.toBeTruthy();
    expect(token).toHaveBeenCalledTimes(2);
  });
});

describe('turnstile-no-block: interactive only on user intent', () => {
  function interactiveApi() {
    let opts: Record<string, (arg?: unknown) => unknown> = {};
    const api = {
      render: vi.fn((_el: HTMLElement, o: Record<string, unknown>) => {
        opts = o as typeof opts;
        return 'w1';
      }),
      execute: vi.fn(() => queueMicrotask(() => opts['before-interactive-callback']!())),
      reset: vi.fn(),
    };
    return { api, opts: () => opts };
  }
  const overlay = () => document.getElementById('aduin-turnstile');

  it('a background request that needs interaction resolves null without showing the overlay', async () => {
    const { api } = interactiveApi();
    const p = createTurnstileProvider('site-key', { loadApi: async () => api });
    expect(await p({ interactive: false })).toBeNull();
    expect(overlay()?.getAttribute('role')).not.toBe('dialog');
    expect(overlay()?.getAttribute('aria-hidden')).toBe('true');
    expect(api.reset).toHaveBeenCalledTimes(1);
  });

  it('a user-intent request shows the overlay with the AI and memory copy', async () => {
    const { api, opts } = interactiveApi();
    const p = createTurnstileProvider('site-key', { loadApi: async () => api });
    const tok = p({ interactive: true });
    await vi.waitFor(() => expect(overlay()?.getAttribute('role')).toBe('dialog'));
    expect(overlay()?.textContent).toContain('Verify you are human to use AI and memory features');
    opts()['callback']!('tok-human');
    expect(await tok).toBe('tok-human');
  });

  it('turnstileToken is non-interactive by default and interactive right after user intent', async () => {
    const seen: (boolean | undefined)[] = [];
    turnstile.setTurnstileProvider(async (o) => {
      seen.push(o?.interactive);
      return null;
    });
    await turnstile.turnstileToken();
    turnstile.markUserIntent();
    await turnstile.turnstileToken();
    turnstile.resetUserIntentForTest();
    await turnstile.turnstileToken({ interactive: true });
    expect(seen).toEqual([false, true, true]);
  });

  it('user intent drops the memory client cached failure', async () => {
    const cleared = vi.fn();
    const off = turnstile.onUserIntent(cleared);
    turnstile.markUserIntent();
    off();
    expect(cleared).toHaveBeenCalledTimes(1);
  });
});
