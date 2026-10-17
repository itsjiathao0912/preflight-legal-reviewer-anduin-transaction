import { describe, expect, it } from 'vitest';
import { blockText } from '../helpers/samples';
import { extractPrimaryFacts } from '../../src/package/index';
import {
  designFiles,
  expectedJson,
  graphOf,
  HARTWELL,
  load,
  runPackage,
} from '../helpers/package-fixtures';

/** AC-I10: references found with a verbatim quote and a location that resolves. */
const E = expectedJson();

async function primary(rel: string) {
  const l = await load(rel);
  const g = graphOf(l);
  return { g, p: extractPrimaryFacts(g, l.hash) };
}

describe('package-reference-extraction-golden (AC-I10)', () => {
  it('Hartwell Fund III: pattern matrix (families, labels, mentions)', async () => {
    const { g, p } = await primary(HARTWELL.sub);
    const got: Record<string, number> = {};
    for (const r of p.references)
      got[`${r.targetFamily}|${r.targetLabel}`] =
        (got[`${r.targetFamily}|${r.targetLabel}`] ?? 0) + 1;
    const want = Object.fromEntries(
      E.hartwell.references.map((r) => [`${r.family}|${r.label}`, r.mentions]),
    );
    expect(got).toEqual(want);
    for (const lbl of E.hartwell.internalLabelsNotExternal)
      expect(p.references.some((r) => r.targetLabel === lbl)).toBe(false);
    for (const r of p.references) {
      const text = blockText(g, r.location.blockIndex);
      expect(text).toContain(r.quote);
      expect(r.quote.length).toBeLessThanOrEqual(240);
      expect(text.slice(r.location.start, r.location.end)).toBe(r.targetLabel);
    }
    expect(p.carveOutTarget).toBe('Partnership Agreement');
  });

  it('carve-out sentence is quoted verbatim', async () => {
    const { p } = await primary(HARTWELL.sub);
    expect(p.references[0]!.quote).toBe(
      'Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.',
    );
  });

  it.each([5, 6])(
    'NGI #%i: LLC Agreement / Memorandum / Prospectus references are found verbatim',
    async (n) => {
      const rel = `samples/sub-docs/raw/0${n}-partners-group-ngi-${n === 5 ? 2024 : 2026}.htm`;
      const { g, p } = await primary(rel);
      expect(p.references.length).toBeGreaterThan(0);
      expect(p.dropped).toBe(0);
      for (const r of p.references) expect(blockText(g, r.location.blockIndex)).toContain(r.quote);
      const fams = new Set(p.references.map((r) => r.targetFamily));
      expect(fams.has('lpa') || fams.has('ppm')).toBe(true);
    },
  );

  it.each(Object.keys(E.design))('design package %s: answer-key quotes and targets', async (id) => {
    const e = E.design[id]!;
    const r = await runPackage(designFiles(id));
    const keys = new Set(r.analysis.references.map((x) => x.targetKey));
    for (const k of [...e.notInPackage, ...e.resolved]) expect(keys.has(k), k).toBe(true);
    for (const q of e.quotes ?? [])
      expect(
        r.analysis.references.some((x) => x.quote === q),
        q,
      ).toBe(true);
    if (e.annexCMentions)
      expect(r.analysis.references.filter((x) => x.targetKey === 'annex:annex c')).toHaveLength(
        e.annexCMentions,
      );
  });
});
