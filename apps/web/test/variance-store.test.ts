import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackageDocument } from '@aduin/core';

// Variance Phase 02 (B3/F2/C2): the variance store. The engine client delegates to the real worker
// module (real core runVariance); a gate lets a test hold a pass to exercise the stale-run drop.
const h = vi.hoisted(() => ({ gate: null as Promise<void> | null, calls: 0, never: false }));
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));
vi.mock('../src/engine/client', async () => {
  const { api } = await import('../src/engine/engine.worker');
  return {
    analyzeInWorker: (...a: Parameters<typeof api.analyze>) => api.analyze(...a),
    readPackageDocInWorker: (...a: Parameters<typeof api.readPackageDoc>) =>
      api.readPackageDoc(...a),
    rememberInput: () => undefined,
    runVarianceInWorker: async (...a: Parameters<typeof api.runVariance>) => {
      h.calls++;
      if (h.never) return new Promise(() => undefined);
      const g = h.gate;
      if (g) await g;
      return api.runVariance(...a);
    },
  };
});

const { api } = await import('../src/engine/engine.worker');
const { useVariance, isPending } = await import('../src/features/variance/variance-store');
const T = await import('../src/features/variance/types');
const { useReview } = await import('../src/state/review');
const { usePackage } = await import('../src/state/package');
const { appDb } = await import('../src/storage/db');
type DocMeta = import('../src/state/review').DocMeta;
type EngineResult = import('../src/engine/types').EngineResult;

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const sample = (f: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'apps', 'web', 'public', 'samples', f)));
const NEW = sample('06-partners-group-ngi-2026.htm');
const OLD = sample('05-partners-group-ngi-2024.htm');
const HART = new Uint8Array(
  readFileSync(
    join(ROOT, 'fixtures', 'package', 'hartwell', 'fund-ii-subscription-agreement-prior.html'),
  ),
);
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function until(fn: () => boolean, ms = 5000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await settle(10);
  }
}

async function upload(
  id: string,
  firmId: string | null,
  bytes: Uint8Array,
  name: string,
  createdAt = Date.now(),
) {
  await appDb()!.documents.put({
    id,
    name,
    kind: 'upload',
    bytes,
    firmId,
    fund: 'NGI',
    version: 'v',
    createdAt,
  });
}

/** Open a document in the review store (loading -> ready), the way openDocument completes. */
async function open(
  meta: Omit<DocMeta, 'id'>,
  bytes: Uint8Array,
): Promise<{ doc: DocMeta; result: EngineResult }> {
  const result = await api.analyze({ kind: 'html', bytes, name: 'x.html' }, {}, () => undefined);
  const doc: DocMeta = { ...meta, id: result.docHash };
  useReview.setState({ phase: 'loading', result: null, doc: null });
  useReview.setState({ phase: 'ready', doc, result, triage: {}, memory: null });
  return { doc, result };
}

const meta = (ref: string, firmId: string | null = 'partners-group'): Omit<DocMeta, 'id'> => ({
  name: `${ref}.htm`,
  firmId,
  firmName: 'Partners Group',
  fund: 'NGI',
  version: ref,
  source: 'upload',
  ref,
});

beforeEach(async () => {
  h.gate = null;
  h.calls = 0;
  h.never = false;
  usePackage.getState().clear();
  useVariance.getState().reset();
  const db = appDb()!;
  await Promise.all([db.documents.clear(), db.uiState.clear(), db.packages.clear()]);
});
afterEach(async () => {
  vi.useRealTimers();
  useVariance.getState().reset();
  await settle();
});

describe('variance-store', () => {
  it('should pick one baseline by tie-break, drop a stale run, carry gatePolicy with the ready result and time out to a muted error', async () => {
    // first review: no baseline -> the muted line, then the pointer is written (uiState key)
    await upload('up_old', 'partners-group', OLD, '05.htm');
    const first = await open(meta('up_old'), OLD);
    expect(useVariance.getState().status).toBe('resolving'); // same update as the findings
    await until(() => useVariance.getState().status === 'none');
    expect(useVariance.getState().line).toBe(T.NO_BASELINE_LINE);
    await until(() => h.calls === 0 && true);
    await settle(50);
    const ptr = await appDb()!.uiState.get('variance:baseline:partners-group');
    expect(ptr?.value).toMatchObject({ docId: 'up_old', docHash: first.doc.id });
    // second review of the same firm: ready with the rules fields as plain JSON
    await upload('up_new', 'partners-group', NEW, '06.htm');
    await open(meta('up_new'), NEW);
    await until(() => useVariance.getState().status === 'ready');
    const s = useVariance.getState();
    expect(s.baseline).toMatchObject({ docId: 'up_old', path: 'pointer' });
    expect(s.result?.findings.length).toBeGreaterThan(0);
    expect(s.result?.gatePolicy).toEqual({
      untriaged_change_blocks: true,
      asked_unanswered_blocks: true,
      regression_blocks: true,
    });
    expect(s.result?.rulesVersion).toMatch(/^\d{4}\./);
    expect(s.result?.rulesHash8).toMatch(/^[0-9a-f]{8}$/);
    // no Dexie version bump
    expect(appDb()!.verno).toBe(2);
  });

  it('drops a stale run when the baseline changes mid-run (run id)', async () => {
    await upload('up_old', 'partners-group', OLD, '05.htm');
    await upload('up_hart', 'partners-group', HART, 'hart.html', Date.now() - 1000);
    await appDb()!.uiState.put({
      key: 'variance:baseline:partners-group',
      value: { docId: 'up_old', name: '05.htm', setAt: 1 },
      updatedAt: 1,
    });
    let release!: () => void;
    h.gate = new Promise<void>((r) => (release = r));
    await upload('up_new', 'partners-group', NEW, '06.htm');
    await open(meta('up_new'), NEW);
    await until(() => useVariance.getState().status === 'running');
    const staleRun = useVariance.getState().runId;
    // the analyst picks another baseline while the first pass is held
    h.gate = null;
    const r = await useVariance.getState().choose('up_hart');
    expect(r).toEqual({ ok: true });
    await until(() => useVariance.getState().status === 'ready');
    const fresh = useVariance.getState();
    expect(fresh.runId).not.toBe(staleRun);
    expect(fresh.baseline?.docId).toBe('up_hart');
    const freshIds = fresh.result!.findings.map((f) => f.id);
    release();
    await settle(300);
    // the held (stale) result never replaced the fresh one
    expect(useVariance.getState().baseline?.docId).toBe('up_hart');
    expect(useVariance.getState().result!.findings.map((f) => f.id)).toEqual(freshIds);
  });

  it('package path: one baseline, the others ignored', async () => {
    const pd = (id: string, name: string, role: PackageDocument['role']): PackageDocument => ({
      id,
      name,
      type: 'sub_agreement',
      role,
      confidence: 'high',
      reason: 'r',
      confirmed: true,
      suggestionSource: 'rule',
      needsOcr: false,
      format: 'html',
      titleLines: [],
    });
    const result = await api.analyze(
      { kind: 'html', bytes: NEW, name: 'x.html' },
      {},
      () => undefined,
    );
    await upload('up_a', 'partners-group', OLD, 'a.htm');
    const docs = [
      pd(result.docHash, '06.htm', 'to_digitize'),
      pd('a'.repeat(64), 'a-ngi-2024.htm', 'baseline'),
      pd('b'.repeat(64), 'b-hartwell.htm', 'baseline'),
    ];
    usePackage.setState({
      current: {
        id: 'pkg_s',
        tag: { firmId: 'partners-group', firmName: 'PG', fund: 'NGI', version: 'v' },
        docs,
        primaryDocId: result.docHash,
        confirmedTargets: {},
        createdAt: 1,
      },
    });
    await appDb()!.packages.put({
      id: 'pkg_s',
      firmId: 'partners-group',
      firmName: 'PG',
      fund: 'NGI',
      version: 'v',
      createdAt: 1,
      primaryDocId: result.docHash,
      confirmedTargets: {},
      docs: docs.map(({ titleLines: _t, ...d }) => ({
        ...d,
        ...(d.id === 'a'.repeat(64) ? { storedDocId: 'up_a' } : {}),
      })),
    });
    const doc: DocMeta = { ...meta('up_new'), id: result.docHash, packageId: 'pkg_s' };
    useReview.setState({ phase: 'loading', result: null, doc: null });
    useReview.setState({ phase: 'ready', doc, result, triage: {}, memory: null });
    await until(() => useVariance.getState().status === 'ready');
    expect(useVariance.getState().baseline).toMatchObject({
      docId: 'a'.repeat(64),
      path: 'package',
    });
    expect(useVariance.getState().ignored).toBe(1);
    // a role change re-runs the pass without re-opening the primary (D-S0-2)
    const before = useVariance.getState().runId;
    const c = usePackage.getState().current!;
    usePackage.setState({
      current: {
        ...c,
        docs: c.docs.map((d) =>
          d.id === 'b'.repeat(64) ? { ...d, role: 'reference' as const } : d,
        ),
      },
    });
    await until(
      () => useVariance.getState().runId !== before && useVariance.getState().status === 'ready',
    );
    expect(useVariance.getState().ignored).toBe(0);
    expect(useReview.getState().phase).toBe('ready');
  });

  it('a pass that never answers ends pending by the named timeout (muted error line)', async () => {
    await upload('up_old', 'partners-group', OLD, '05.htm');
    await appDb()!.uiState.put({
      key: 'variance:baseline:partners-group',
      value: { docId: 'up_old', name: '05.htm', setAt: 1 },
      updatedAt: 1,
    });
    h.never = true;
    await upload('up_new', 'partners-group', NEW, '06.htm');
    const result = await api.analyze(
      { kind: 'html', bytes: NEW, name: 'x.html' },
      {},
      () => undefined,
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    useReview.setState({ phase: 'loading', result: null, doc: null });
    useReview.setState({ phase: 'ready', doc: { ...meta('up_new'), id: result.docHash }, result });
    await vi.waitFor(() => expect(useVariance.getState().status).toBe('running'));
    expect(isPending(useVariance.getState())).toBe(true);
    vi.advanceTimersByTime(T.VARIANCE_PENDING_TIMEOUT_MS + 1);
    expect(useVariance.getState().status).toBe('error');
    expect(useVariance.getState().line).toBe(T.ERROR_LINE);
    expect(isPending(useVariance.getState())).toBe(false);
  });

  it('unknown firm settles at once with no pending display; loading resets the slice', async () => {
    const r = await api.analyze({ kind: 'html', bytes: NEW, name: 'x.html' }, {}, () => undefined);
    useReview.setState({ phase: 'loading', result: null, doc: null });
    useReview.setState({ phase: 'ready', doc: { ...meta('s', null), id: r.docHash }, result: r });
    expect(useVariance.getState().status).toBe('none');
    expect(useVariance.getState().line).toBeNull();
    useReview.setState({ phase: 'loading', result: null });
    expect(useVariance.getState().status).toBe('idle');
  });
});
