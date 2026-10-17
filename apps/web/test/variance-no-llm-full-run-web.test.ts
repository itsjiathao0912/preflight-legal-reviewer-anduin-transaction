import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/engine/engine.worker';
import type { RunVarianceInput } from '../src/engine/types';

// Variance Phase 02 (AC-V20 web part): the engine-worker variance pass needs no LLM and no
// network; repeated opens give identical rows; the result is plain JSON carrying the rules fields.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const hart = (f: string) =>
  new Uint8Array(readFileSync(join(ROOT, 'fixtures', 'package', 'hartwell', f)));
const SUB = 'fund-iii-subscription-agreement.html';
const PRIOR = 'fund-ii-subscription-agreement-prior.html';
const noop = () => undefined;

let calls = 0;
beforeEach(() => {
  calls = 0;
  vi.stubGlobal('fetch', async () => {
    calls++;
    throw new Error('network is not allowed in this test');
  });
});
afterEach(() => vi.unstubAllGlobals());

async function openAndRun(): Promise<Awaited<ReturnType<typeof api.runVariance>>> {
  const r = await api.analyze({ kind: 'html', bytes: hart(SUB), name: SUB }, {}, noop);
  const input: RunVarianceInput = {
    baseline: { kind: 'html', bytes: hart(PRIOR), name: PRIOR },
    baselineSide: { firmId: 'firm-x', label: 'Fund II' },
    current: { docHash: r.docHash },
    currentSide: { firmId: 'firm-x', label: 'Fund III v1' },
  };
  return api.runVariance(input, {});
}

describe('variance-no-llm-full-run-web', () => {
  it('should show identical variance rows on repeated opens with no network', async () => {
    const a = await openAndRun();
    const b = await openAndRun();
    expect(calls).toBe(0);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.findings.length).toBeGreaterThan(0);
    expect(a.findings.every((f) => f.kind === 'change' && f.issue_class === 'version_drift')).toBe(
      true,
    );
    expect(a.findings.every((f) => f.detector_kind !== 'ai')).toBe(true);
    // identical rows (ids, titles, order) and identical summary
    expect(b.findings.map((f) => [f.id, f.title, f.order])).toEqual(
      a.findings.map((f) => [f.id, f.title, f.order]),
    );
    expect(b.summary).toEqual(a.summary);
    expect(a.summary.shown).toBe(a.findings.length);
    // every row has decoded meta; rules fields travel as plain JSON from the worker
    for (const f of a.findings) expect(a.meta[f.id]?.kind).toBe('change');
    expect(a.gatePolicy).toEqual({
      untriaged_change_blocks: true,
      asked_unanswered_blocks: true,
      regression_blocks: true,
    });
    expect(a.rulesVersion).toMatch(/^\d{4}\.\d+\.\d+$/);
    expect(a.rulesHash8).toMatch(/^[0-9a-f]{8}$/);
    expect(() => structuredClone(a)).not.toThrow();
  });

  it('refuses a cross-firm pair (core step 0) and a missing current document', async () => {
    const r = await api.analyze({ kind: 'html', bytes: hart(SUB), name: SUB }, {}, noop);
    const cross = await api.runVariance(
      {
        baseline: { kind: 'html', bytes: hart(PRIOR), name: PRIOR },
        baselineSide: { firmId: 'firm-y', label: 'Fund II' },
        current: { docHash: r.docHash },
        currentSide: { firmId: 'firm-x', label: 'Fund III' },
      },
      {},
    );
    expect(cross.ok && cross.notice).toBe('cross_firm');
    expect(cross.ok && cross.findings.length).toBe(0);
    const gone = await api.runVariance(
      {
        baseline: { kind: 'html', bytes: hart(PRIOR), name: PRIOR },
        baselineSide: { firmId: 'firm-x', label: 'Fund II' },
        current: { docHash: 'f'.repeat(64) },
        currentSide: { firmId: 'firm-x', label: 'Fund III' },
      },
      {},
    );
    expect(gone).toEqual({ ok: false, side: 'current', code: 'not_retained' });
  });
});
