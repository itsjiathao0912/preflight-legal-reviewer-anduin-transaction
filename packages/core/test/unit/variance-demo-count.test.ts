import { describe, expect, it } from 'vitest';
import { runRegressionChecks, runVariance } from '../../src/variance/index';
import { demoPair, expectedDemo, vside } from '../helpers/variance';

/**
 * AC-V4 (core): Hartwell & Crane Fund III vs Fund II: 214 raw changes give exactly 7 shown changes
 * (3 new, 4 logic) and 207 cosmetic hunks in 5 groups (118 renumber, 41 fund name, 8 date,
 * 29 Units to Shares, 11 format). The hand-authored item table is asserted row by row. Fund III
 * has no Appendix C row (both versions lack it); the R-01 regression comes only from the separate
 * `runRegressionChecks` call, so `summary.shown` counts change rows only.
 */
const exp = expectedDemo();

describe('variance-demo-count', () => {
  it('should report raw 214, shown 7 (3 new, 4 logic) and 207 cosmetic in 5 groups on the demo pair', () => {
    // the authored expectations themselves are the plan pins
    expect([exp.raw, exp.shown, exp.new, exp.changed_logic, exp.cosmetic]).toEqual([
      214, 7, 3, 4, 207,
    ]);
    const r = runVariance(demoPair());
    expect(r.notice).toBeUndefined();
    expect(r.summary).toEqual({ raw: 214, shown: 7, cosmetic: 207, new: 3, changed_logic: 4 });
    expect(r.cosmeticGroups).toHaveLength(5);
    expect(Object.fromEntries(r.cosmeticGroups.map((g) => [g.key, g.count]))).toEqual({
      'VAR-COS-RENUMBER': 118,
      'VAR-COS-NAME:II -> III': 41,
      'VAR-COS-DATE': 8,
      'VAR-COS-RENAME:Units -> Shares': 29,
      'VAR-COS-FORMAT': 11,
    });
    expect(Object.fromEntries(r.cosmeticGroups.map((g) => [g.key, g.count]))).toEqual(exp.groups);
    for (const g of r.cosmeticGroups) expect(g.examples.length).toBe(3);
  });

  it('matches the hand-authored item table (unit, class, rule id, owners), one raw change each', () => {
    const r = runVariance(demoPair());
    const metas = r.findings.map((f) => r.meta[f.id]!);
    expect(metas.map((m) => m.unit_key_b).sort()).toEqual(
      exp.items.map((i) => i.unit_key_b).sort(),
    );
    for (const it of exp.items) {
      const m = metas.find((x) => x.unit_key_b === it.unit_key_b)!;
      expect([m.change_type, m.rule_id, m.owners, m.hunk_count], it.id).toEqual([
        it.class,
        it.rule_id,
        it.owners,
        1,
      ]);
      expect(`${m.old_text} ${m.new_text}`, it.id).toContain(it.passage);
    }
    expect(metas.some((m) => m.unit_key_a === 'appendix:c' || m.unit_key_b === 'appendix:c')).toBe(
      false,
    );
    expect(
      r.findings.every((f) => f.severity === 'medium' && f.issue_class === 'version_drift'),
    ).toBe(true);
  });

  it('runs the R-01 chain: Fund II removes Appendix C, Fund III violates the check, the variant holds', () => {
    const setup = runVariance({
      baseline: vside('hartwell-crane/fund-I.html', 'Fund I'),
      current: vside('hartwell-crane/fund-II.html', 'Fund II'),
    });
    const removed = Object.values(setup.meta).find(
      (m) => m.unit_key_a === exp.r01.removed_unit_key_a,
    )!;
    expect(removed.rule_id).toBe('VAR-LOGIC-REMOVED');
    expect(removed.assertion_candidate).toEqual(exp.r01.assertion);
    const check = {
      kind: 'scope_exists' as const,
      label: 'Appendix C',
      statement: exp.r01.statement,
      sourceFundName: exp.r01.source_fund,
    };
    const fund3 = vside('hartwell-crane/fund-III.html', 'Fund III');
    expect(runRegressionChecks(fund3.structure, [check])).toHaveLength(1);
    const held = vside('hartwell-crane/fund-III-with-appendix-c.html', 'Fund III');
    expect(runRegressionChecks(held.structure, [check])).toEqual([]);
    // runVariance never runs checks: the shown count stays 7
    expect(runVariance(demoPair()).summary.shown).toBe(7);
  });
});
