import { describe, expect, it, vi } from 'vitest';
import type { MemoryApi } from '../src/api/memoryApi';
import type { RunRegressionRef } from '../src/engine/types';

// Variance Phase 04 (E1): `runRegression` on `doc_not_retained` (engine LRU evicted the graph)
// re-runs from the remembered analyze input; with none, it skips silently (no finding, no error).
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
const { fetchRegression } = await import('../src/features/variance/regression-client');

const DOC = { id: 'a'.repeat(64), firmId: 'hartwell-crane' };
const CHECK = {
  id: 'rc_1',
  assertion_kind: 'scope_exists' as const,
  assertion_key: 'appendix c',
  statement_text: 'Appendix C must exist',
  source_fund_name: 'Fund II',
};
const api = {
  lookupWithChecks: async () => ({ decisions: [], regression_checks: [CHECK] }),
} as unknown as MemoryApi;
const FINDING = { id: 'f_reg', kind: 'change', title: 'Regression: confirmed in Fund II' };

describe('variance-regression-doc-not-retained', () => {
  it('should re-run a regression check from the remembered input after LRU eviction, and skip silently when none exists', async () => {
    const refs: RunRegressionRef[] = [];
    const run = vi.fn(async (ref: RunRegressionRef) => {
      refs.push(ref);
      return ref.input
        ? ({ ok: true, findings: [FINDING], meta: {} } as never)
        : ({ ok: false, code: 'doc_not_retained' } as const);
    });
    const input = { kind: 'html' as const, bytes: new Uint8Array([60]) };
    const got = await fetchRegression(DOC, [], { api, run, inputOf: () => input });
    expect(refs).toEqual([{ docHash: DOC.id }, { docHash: DOC.id, input }]);
    expect(got?.findings).toEqual([FINDING]);
    expect(got?.docId).toBe(DOC.id);

    run.mockClear();
    refs.length = 0;
    const none = await fetchRegression(DOC, [], { api, run, inputOf: () => undefined });
    expect(none).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('no checks: an empty slice and no engine call; no firm: nothing at all', async () => {
    const run = vi.fn();
    const empty = {
      lookupWithChecks: async () => ({ decisions: [], regression_checks: [] }),
    } as unknown as MemoryApi;
    expect(await fetchRegression(DOC, [], { api: empty, run, inputOf: () => undefined })).toEqual({
      docId: DOC.id,
      findings: [],
      meta: {},
    });
    expect(run).not.toHaveBeenCalled();
    expect(
      await fetchRegression({ id: 'x', firmId: null }, [], { api, run, inputOf: () => undefined }),
    ).toBeNull();
  });

  it('a failed lookup is silent (memory never blocks the review)', async () => {
    const broken = {
      lookupWithChecks: async () => Promise.reject(new Error('503')),
    } as unknown as MemoryApi;
    const run = vi.fn();
    expect(
      await fetchRegression(DOC, [], { api: broken, run, inputOf: () => undefined }),
    ).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});
