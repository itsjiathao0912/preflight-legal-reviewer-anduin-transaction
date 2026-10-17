import { describe, expect, it } from 'vitest';
import { typesIn } from '../../src/investor/types';
import { IMPACT_PROVENANCE, runVariance } from '../../src/variance/index';
import { doc, expectedSeeded, seededPair, sideOfHtml } from '../helpers/variance';

/**
 * AC-V10: impact comes from the logic graph. On the authored impact fixtures: a change inside a
 * section only trusts complete affects only the trust investor type (the changed words name no
 * type, so the restriction can only come from the investor paths); a changed conditional target
 * is an affected conditional path (old -> new); a wording change outside every path with no form
 * element is reusable; anything uncertain is "no".
 */
const cases = expectedSeeded().filter((c) => c.kind === 'impact');

describe('variance-impact-from-graph-fixtures', () => {
  it('should compute affected investor types and conditional paths from the logic graph', () => {
    expect(cases.map((c) => c.id)).toEqual([
      'impact-trust-only',
      'impact-conditional',
      'impact-reusable',
    ]);
    for (const c of cases) {
      const r = runVariance(seededPair(c.id));
      const e = c.expect.rows![0]!;
      const m = r.meta[r.findings[0]!.id]!;
      expect(m.unit_key_b, c.id).toBe(e.unit_key_b);
      const impact = m.impact!;
      for (const t of e.investor_types_include ?? [])
        expect(impact.investor_types, c.id).toContain(t);
      for (const t of e.investor_types_exclude ?? [])
        expect(impact.investor_types, c.id).not.toContain(t);
      if (e.conditionals !== undefined)
        expect(impact.conditionals, c.id).toHaveLength(e.conditionals);
      if (e.reusable) expect(impact.reusable, c.id).toBe(e.reusable);
    }
  });

  it('derives the trust-only restriction from the paths, not from the changed words', () => {
    const r = runVariance(seededPair('impact-trust-only'));
    const m = r.meta[r.findings[0]!.id]!;
    expect(typesIn(`${m.old_text} ${m.new_text}`)).not.toContain('trust');
    expect(m.impact!.investor_types).toEqual(['trust']);
    expect(m.impact!.uncertain).toBe(false);
  });

  it('reports the changed conditional as an old -> new pair', () => {
    const r = runVariance(seededPair('impact-conditional'));
    const m = r.meta[r.findings[0]!.id]!;
    expect(m.impact!.conditionals).toEqual([
      {
        old: 'If the Investor is a trust -> complete Section 5',
        new: 'If the Investor is a trust -> complete Section 6',
      },
    ]);
    expect(m.impact!.reusable).toBe('no');
  });

  it('labels a document without an investor model as uncertain (never reusable)', () => {
    const body = (w: string) =>
      doc(
        ['Kestrel Point Income Fund II, L.P.'],
        [
          ['1', 'Payment', [`Subscription monies are paid by ${w} transfer.`]],
          ['2', 'Signatures', ['The Investor signs below.']],
        ],
      );
    const r = runVariance({
      baseline: sideOfHtml(body('wire'), 'A'),
      current: sideOfHtml(body('bank'), 'B'),
    });
    const impact = r.meta[r.findings[0]!.id]!.impact!;
    expect(impact.uncertain).toBe(true);
    expect(impact.reusable).toBe('no');
    expect(impact.line).toContain('(uncertain)');
    expect(IMPACT_PROVENANCE).toBe('from the logic graph and qualifier rules, deterministic');
  });
});
