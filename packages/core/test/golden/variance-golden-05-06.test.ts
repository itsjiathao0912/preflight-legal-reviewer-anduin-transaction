import { describe, expect, it } from 'vitest';
import { runVariance } from '../../src/variance/index';
import { sampleVSide } from '../helpers/variance';

/**
 * AC-V7 (real data #5 2024 -> #6 2026): "Units" to "Shares" is cosmetic (hidden), class-specific
 * fees are changed_logic, Appendix C removed is shown as a change (with the R-01 assertion
 * candidate). Unit keys were measured after Intake's heading / conditional edits (E13):
 * `appendix:c` and `signature:1/s6/pb` are the keys the landed structurer produces; the swapped
 * references stay in the existing diff (`golden-05-06-drift`).
 */
const r = runVariance({ baseline: sampleVSide(5, '#5'), current: sampleVSide(6, '#6') });
const rows = r.findings.map((f) => r.meta[f.id]!);

describe('variance-golden-05-06', () => {
  it('should classify Units to Shares cosmetic, class fees logic and Appendix C removed as shown on pair 5 to 6', () => {
    // Units -> Shares: every plain substitution is cosmetic in one rename group
    const units = r.rawChanges.filter(
      (h) => /^Units?$/.test(h.oldText) && /^Shares?$/.test(h.newText),
    );
    expect(units.length).toBe(28); // 25 plural + 3 singular
    expect(
      units.every((h) => h.class === 'changed_cosmetic' && h.ruleId === 'VAR-COS-RENAME'),
    ).toBe(true);
    const g = r.cosmeticGroups.find((x) => x.key === 'VAR-COS-RENAME:Units -> Shares');
    expect(g?.count).toBe(28);
    // class-specific fees: the Class S fee insertion sits in a shown changed_logic row
    const fees = rows.find((m) => m.unit_key_b === 'signature:1/s6/pb')!;
    expect(fees.change_type).toBe('changed_logic');
    expect(fees.new_text).toContain('1.5%');
    expect(
      r.rawChanges
        .filter((h) => /%/.test(h.oldText + h.newText))
        .every((h) => h.class !== 'changed_cosmetic'),
    ).toBe(true);
    // Appendix C removed: shown, with the scope_exists candidate
    const appC = rows.find((m) => m.unit_key_a === 'appendix:c')!;
    expect(appC).toMatchObject({
      change_type: 'changed_logic',
      rule_id: 'VAR-LOGIC-REMOVED',
      unit_key_b: null,
      quote_side: 'old',
      assertion_candidate: { kind: 'scope_exists', label: 'appendix c' },
    });
  });

  it('pins the measured #5 -> #6 counts and the other renames as cosmetic', () => {
    expect(r.summary).toEqual({ raw: 163, shown: 20, cosmetic: 65, new: 0, changed_logic: 20 });
    expect(r.cosmeticGroups.map((x) => [x.key, x.count])).toEqual([
      ['VAR-COS-DATE', 5],
      ['VAR-COS-RENAME:Member -> Shareholder', 4],
      ['VAR-COS-RENAME:Memorandum -> Prospectus', 6],
      ['VAR-COS-RENAME:Placement Fee -> Sales Load', 3],
      ['VAR-COS-RENAME:Units -> Shares', 28],
      ['VAR-COS-RENAME:placement agent -> distributor', 4],
      ['VAR-COS-FORMAT', 15],
    ]);
    // the one "Units" change that is not a plain rename adds Class S: logic
    const classS = r.rawChanges.find((h) => h.newText === 'Shares and Class S Shares')!;
    expect(classS.class).toBe('changed_logic');
  });
});
