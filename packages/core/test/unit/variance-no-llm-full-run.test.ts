import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCounselSheet } from '../../src/counsel/sheet';
import { computeGate } from '../../src/counsel/gate';
import {
  loadVarianceRules,
  questionKey,
  runRegressionChecks,
  runVariance,
} from '../../src/variance/index';
import { demoPair, vside } from '../helpers/variance';

/**
 * AC-V20: the whole variance pipeline (classify, impact, routing, findings, regression check,
 * gate, per-owner sheet) runs with no network and no transport: `fetch` is replaced by a spy that
 * throws, and the variance sources import nothing from the LLM layer.
 */
const SRC = fileURLToPath(new URL('../../src/variance/', import.meta.url));

describe('variance-no-llm-full-run', () => {
  const fetchSpy = vi.fn(() => {
    throw new Error('network is not allowed in variance');
  });
  beforeEach(() => vi.stubGlobal('fetch', fetchSpy));
  afterEach(() => vi.unstubAllGlobals());

  it('should run end to end with no network and no transport', () => {
    const r = runVariance(demoPair());
    expect(r.summary.shown).toBe(7);
    const reg = runRegressionChecks(vside('hartwell-crane/fund-III.html', 'Fund III').structure, [
      {
        kind: 'scope_exists',
        label: 'Appendix C',
        statement: 'Appendix C must exist',
        sourceFundName: 'Fund II',
      },
    ]);
    const all = [...r.findings, ...reg];
    const gate = computeGate(
      all.map((f) => ({
        id: f.id,
        severity: f.severity,
        detector_kind: f.detector_kind,
        gates: true,
      })),
      {},
      {},
      loadVarianceRules().config.gate_policy,
    );
    expect(gate.status).toBe('blocked');
    expect(gate.reasons).toHaveLength(8);
    const sheet = buildCounselSheet(
      { title: 'Fund III', firm: 'Hartwell & Crane LLP', fund: 'Fund III', version: null },
      r.findings.map((f) => {
        const m = r.meta[f.id]!;
        return {
          id: f.id,
          severity: f.severity,
          issue_class: f.issue_class,
          location: m.title,
          quote: f.quote,
          owners: m.owners,
          change: { change_type: m.change_type, old_text: m.old_text, new_text: m.new_text },
        };
      }),
      {},
      {},
      { owner: 'gp' },
    );
    expect(sheet.questions.map((q) => q.findingKey)).toEqual(
      r.findings
        .filter((f) => r.meta[f.id]!.owners.includes('gp'))
        .map((f) => questionKey(f.id, 'gp')),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('imports nothing from the LLM layer or the network', () => {
    for (const f of readdirSync(SRC).filter((x) => x.endsWith('.ts'))) {
      const text = readFileSync(SRC + f, 'utf8');
      expect(text, f).not.toMatch(/from '\.\.\/llm/);
      expect(text, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket/);
    }
  });
});
