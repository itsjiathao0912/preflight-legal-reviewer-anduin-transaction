import { describe, expect, it } from 'vitest';
import { buildUnits, type Unit } from '../../src/diff/align';
import { runDeterministic } from '../../src/engine';
import {
  CHANGE_CLASSES,
  RULE_IDS,
  runVariance,
  type ClassifiedHunk,
  type VarianceResult,
  type VarianceSide,
} from '../../src/variance/index';
import { graphOf, load } from '../helpers/package-fixtures';

/**
 * AC-V4 corroboration on a real DOCX pair (D-S0-5, plan H4): design Northgate Fund III
 * (01-NG3) vs the Fund II baseline (04-NG2), read from fixtures/package/design/northgate-iii (the
 * committed, checksum-guarded copy; never samples/packages). Asserted: (a) recall 7 of 7 — each
 * answer-key passage lies inside a NON-cosmetic hunk of a SHOWN change row and in no cosmetic
 * hunk; (b) one class and rule id per raw change; (c) measured pins; (d) byte-equal runs.
 * RECORDED, NOT ASSERTED (phase report + backlog note): the key's "7 shown = 3 new + 4
 * changed_logic", the per-item class and the trust-row owner. Units are top-level sections, so key
 * items share rows, and operative-text digit changes (address, dates, C-3 labels) are logic.
 */
const D = 'fixtures/package/design/northgate-iii/';

async function side(rel: string, label: string): Promise<VarianceSide> {
  const g = graphOf(await load(D + rel));
  return {
    structure: g.structure,
    graph: g,
    findings: runDeterministic(g),
    firmId: 'firm-x',
    label,
  };
}

/** Answer key section B passages (samples/packages/01-northgate-infrastructure-iii/answer-key.md). */
const KEY = [
  { id: 'V1', passage: 'Source of Funds Verification', keyClass: 'new', keyOwner: 'fund_admin' },
  { id: 'V2', passage: 'Singapore', keyClass: 'new', keyOwner: 'gp,counsel' },
  { id: 'V3', passage: 'Sanctions', keyClass: 'new', keyOwner: 'counsel' },
  {
    id: 'V4',
    passage: 'formed or organized outside',
    keyClass: 'changed_logic',
    keyOwner: 'counsel',
  },
  { id: 'V5', passage: '$2,500,000', keyClass: 'changed_logic', keyOwner: 'gp' },
  { id: 'V6', passage: 'select all that apply', keyClass: 'changed_logic', keyOwner: 'counsel' },
  { id: 'V7', passage: 'Revocable trust', keyClass: 'changed_logic', keyOwner: 'counsel' },
] as const;

interface Occ {
  side: 'old' | 'new';
  key: string;
  start: number;
  end: number;
}

function occurrences(units: readonly Unit[], side: 'old' | 'new', passage: string): Occ[] {
  const out: Occ[] = [];
  for (const u of units) {
    let at = u.text.indexOf(passage);
    while (at !== -1) {
      out.push({ side, key: u.key, start: at, end: at + passage.length });
      at = u.text.indexOf(passage, at + 1);
    }
  }
  return out;
}

function touches(h: ClassifiedHunk, o: Occ): boolean {
  const [k, s, e] =
    o.side === 'old' ? [h.unitKeyA, h.oldStart, h.oldEnd] : [h.unitKeyB, h.newStart, h.newEnd];
  if (k !== o.key) return false;
  return s === e ? s >= o.start && s <= o.end : s < o.end && e > o.start;
}

describe('variance-package-01-northgate', () => {
  it('should recall all 7 answer-key passages in non-cosmetic hunks of shown rows on the design Northgate pair and pin the measured counts', async () => {
    const baseline = await side('04-NG2-Subscription-Agreement-2024.docx', 'Northgate Fund II');
    const current = await side('01-NG3-Subscription-Agreement.docx', 'Northgate Fund III');
    const r: VarianceResult = runVariance({ baseline, current });
    const A = buildUnits(baseline.structure);
    const B = buildUnits(current.structure);
    const shownRows = new Set(
      Object.values(r.meta).map((m) => `${m.unit_key_a ?? ''}|${m.unit_key_b ?? ''}`),
    );
    const shown = r.rawChanges.filter(
      (h) =>
        h.class !== 'changed_cosmetic' && shownRows.has(`${h.unitKeyA ?? ''}|${h.unitKeyB ?? ''}`),
    );
    const cosmetic = r.rawChanges.filter((h) => h.class === 'changed_cosmetic');

    // (a) recall 7 of 7
    const table: string[] = [];
    let recalled = 0;
    for (const k of KEY) {
      const occ = [...occurrences(A, 'old', k.passage), ...occurrences(B, 'new', k.passage)];
      const hit = shown.find((h) => occ.some((o) => touches(h, o)));
      const inCosmetic = cosmetic.some((h) => occ.some((o) => touches(h, o)));
      expect(hit, `${k.id} "${k.passage}" in a non-cosmetic hunk of a shown row`).toBeDefined();
      expect(inCosmetic, `${k.id} "${k.passage}" in a cosmetic hunk`).toBe(false);
      recalled++;
      const m = Object.values(r.meta).find(
        (x) => x.unit_key_a === (hit!.unitKeyA ?? null) && x.unit_key_b === (hit!.unitKeyB ?? null),
      )!;
      table.push(
        `${k.id} | key ${k.keyClass} / ${k.keyOwner} | engine ${m.change_type} ${m.rule_id} / ${m.owners.join(',')} | row ${m.unit_key_b ?? m.unit_key_a}`,
      );
    }
    expect(recalled).toBe(7);
    console.log(`package-01 key vs engine:\n${table.join('\n')}`);

    // (b) one class and rule id per raw change, with an old/new passage
    for (const h of r.rawChanges) {
      expect(CHANGE_CLASSES).toContain(h.class);
      expect(RULE_IDS).toContain(h.ruleId);
      expect(h.oldText.length + h.newText.length).toBeGreaterThan(0);
    }

    // (c) measured at EXECUTE (2026-10-17) then pinned
    expect(r.summary).toEqual({ raw: 64, shown: 9, cosmetic: 39, new: 2, changed_logic: 7 });
    expect(r.cosmeticGroups.map((g) => [g.key, g.count])).toEqual([
      ['VAR-COS-NAME:II -> III', 11],
      ['VAR-COS-RENAME:II -> III', 1],
      ['VAR-COS-RENAME:Units -> Interests', 27],
    ]);
    console.log(
      `package-01 measured: ${JSON.stringify(r.summary)}; groups ${r.cosmeticGroups.length}`,
    );

    // (d) two runs are byte-equal
    expect(JSON.stringify(runVariance({ baseline, current }))).toBe(JSON.stringify(r));
  });
});
