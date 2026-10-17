import { describe, expect, it } from 'vitest';
import { runVariance, type VarianceResult } from '../../src/variance/index';
import {
  demoPair,
  expectedDemo,
  expectedSeeded,
  seededPair,
  type ExpectedRow,
} from '../helpers/variance';

/**
 * AC-V5: recall is 100% on every seeded new / logic change (each shown with the correct class and
 * location) and no seeded new / logic change is classified cosmetic. Expectations are the
 * hand-authored `fixtures/variance/expected/*.json`.
 */
function rowFor(r: VarianceResult, e: ExpectedRow) {
  return r.findings
    .map((f) => r.meta[f.id]!)
    .find(
      (m) =>
        (e.unit_key_b === undefined || m.unit_key_b === e.unit_key_b) &&
        (e.unit_key_a === undefined || m.unit_key_a === e.unit_key_a),
    );
}

describe('variance-seeded-recall-matrix', () => {
  it('should show every seeded new and logic change and classify none as cosmetic', () => {
    let seeded = 0;
    let recalled = 0;
    let hiddenAsCosmetic = 0;
    const check = (r: VarianceResult, e: ExpectedRow) => {
      seeded++;
      const m = rowFor(r, e);
      if (m && m.change_type === e.class && m.rule_id === e.rule_id) recalled++;
      expect(m, `row for ${e.unit_key_b ?? e.unit_key_a}`).toBeDefined();
      expect([m!.change_type, m!.rule_id]).toEqual([e.class, e.rule_id]);
      expect(`${m!.old_text} ${m!.new_text}`).toContain(e.contains);
      // the seeded passage never sits in a cosmetic hunk
      const cos = r.rawChanges.filter(
        (h) => h.class === 'changed_cosmetic' && `${h.oldText} ${h.newText}`.includes(e.contains),
      );
      hiddenAsCosmetic += cos.length;
    };
    for (const c of expectedSeeded()) {
      const r = runVariance(seededPair(c.id));
      expect(r.summary.shown, c.id).toBe(c.expect.shown);
      for (const e of c.expect.rows ?? []) check(r, e);
    }
    const demo = runVariance(demoPair());
    for (const it of expectedDemo().items)
      check(demo, {
        class: it.class,
        rule_id: it.rule_id,
        unit_key_b: it.unit_key_b,
        contains: it.passage,
      });
    console.log(
      `variance recall: ${recalled}/${seeded} seeded new/logic changes recalled; logic hidden as cosmetic = ${hiddenAsCosmetic}`,
    );
    expect(seeded).toBe(25); // 18 seeded rows + 7 demo items
    expect(recalled / seeded).toBe(1);
    expect(hiddenAsCosmetic).toBe(0);
  });

  it('shows each cosmetic trap as zero rows with the authored group counts', () => {
    for (const c of expectedSeeded().filter((x) => x.kind === 'cosmetic')) {
      const r = runVariance(seededPair(c.id));
      expect(r.summary.shown, c.id).toBe(0);
      expect(r.summary.cosmetic, c.id).toBe(c.expect.cosmetic);
      expect(Object.fromEntries(r.cosmeticGroups.map((g) => [g.key, g.count]))).toEqual(
        c.expect.groups,
      );
    }
  });
});
