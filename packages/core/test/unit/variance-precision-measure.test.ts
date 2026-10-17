import { describe, expect, it } from 'vitest';
import { runVariance } from '../../src/variance/index';
import { demoPair, expectedSeeded, sampleVSide, seededPair } from '../helpers/variance';

/**
 * AC-V6: cosmetic changes shown as logic are at most 10% of logic rows, measured on the seeded
 * traps plus the demo pair plus real pair #5 -> #6.
 *
 * #5 -> #6 ground truth is HAND-LABELLED below (each shown row was read and judged; not computed
 * from the engine). A row counts as "cosmetic shown as logic" when every change in it belongs to a
 * cosmetic category the rules define (rename, name, renumber, cover date, format, move) but was
 * classified logic. Rows whose only change is an EDGAR page-label artifact ("B-1".."D-2" footers
 * dropped in the 2026 filing) are cosmetic too: since rules 2026.10.2 `VAR-COS-PAGE-LABEL` hides
 * them. The STRICT figure counts any such row still shown as logic as cosmetic shown as logic
 * (EVL fix cycle 1); the in-category figure (without page labels) is printed alongside.
 */
const COSMETIC_SHOWN_AS_LOGIC_05_06: Readonly<Record<string, string>> = {
  'signature:1': 'only "Confidential Private Placement Memorandum" -> "Prospectus" (rename family)',
};
const PAGE_LABEL_ARTIFACT_ROWS_05_06: Readonly<Record<string, string>> = {
  'signature:1/s2/pa': '"B-1" page label dropped',
  'signature:1/s4': '"B-2" page label dropped',
  'signature:1/s10/pd': '"B-6" page label dropped',
  'appendix:a': '"B-9" page label dropped',
  'appendix:b': '"D-1", "D-2" page labels dropped',
};

describe('variance-precision-measure', () => {
  it('should show cosmetic as logic for at most 10% of logic rows', () => {
    let logicRows = 0;
    let falseLogic = 0;
    // seeded traps: every row of a cosmetic trap would be a false logic row
    for (const c of expectedSeeded()) {
      const r = runVariance(seededPair(c.id));
      logicRows += r.summary.changed_logic;
      if (c.kind === 'cosmetic') falseLogic += r.summary.shown;
    }
    // demo pair: the 4 logic rows are the 4 authored logic items (no false row)
    const demo = runVariance(demoPair());
    logicRows += demo.summary.changed_logic;
    expect(demo.summary.changed_logic).toBe(4);
    // real pair #5 -> #6 with the hand-labelled table
    const r56 = runVariance({ baseline: sampleVSide(5, '#5'), current: sampleVSide(6, '#6') });
    const rows = r56.findings.map((f) => r56.meta[f.id]!);
    const logic56 = rows.filter((m) => m.change_type === 'changed_logic');
    const key = (m: (typeof rows)[number]) => m.unit_key_b ?? m.unit_key_a ?? '';
    const false56 = logic56.filter((m) => key(m) in COSMETIC_SHOWN_AS_LOGIC_05_06).length;
    const artifacts56 = logic56.filter((m) => key(m) in PAGE_LABEL_ARTIFACT_ROWS_05_06).length;
    // every labelled cosmetic row really is a shown logic row (the table cannot go stale silently)
    expect(false56).toBe(Object.keys(COSMETIC_SHOWN_AS_LOGIC_05_06).length);
    // the page-label rows are now hidden by VAR-COS-PAGE-LABEL (not shown at all)
    expect(artifacts56).toBe(0);
    const shownKeys = new Set(rows.map(key));
    for (const k of Object.keys(PAGE_LABEL_ARTIFACT_ROWS_05_06))
      expect(shownKeys.has(k), k).toBe(false);
    const pageLabelHunks = r56.rawChanges.filter((h) => h.ruleId === 'VAR-COS-PAGE-LABEL');
    expect(pageLabelHunks.length).toBeGreaterThanOrEqual(6);
    logicRows += logic56.length;
    const inCategory = falseLogic + false56;
    const strict = inCategory + artifacts56;
    const strict56 = (false56 + artifacts56) / logic56.length;
    console.log(
      `variance precision: STRICT ${strict}/${logicRows} logic rows are cosmetic shown as logic (${((strict / logicRows) * 100).toFixed(1)}%), #5/#6 alone ${false56 + artifacts56}/${logic56.length} (${(strict56 * 100).toFixed(1)}%); in-category (page labels excluded) ${inCategory}/${logicRows} (${((inCategory / logicRows) * 100).toFixed(1)}%); page-label hunks hidden ${pageLabelHunks.length}`,
    );
    expect(logic56.length).toBe(15);
    expect(strict / logicRows).toBeLessThanOrEqual(0.1);
    expect(strict56).toBeLessThanOrEqual(0.1);
  });
});
