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

/**
 * AC-I11: recall on seeded references. Ground truth = independent noun counts over block text minus
 * the authored exclusion list (fixtures/package/expected.json). Found = extracted references whose
 * label ends with the noun.
 */
const E = expectedJson();

function truth(text: string, noun: string): number {
  let n = 0;
  const re = new RegExp(`\\b${noun.replace(/ /g, '\\s{1,2}')}\\b`, 'g');
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
    if (E.ngi.exclusions.some((x: string) => before.endsWith(x))) continue;
    n++;
  }
  return n;
}

describe('package-reference-recall-matrix (AC-I11)', () => {
  it.each([5, 6])(
    'NGI #%i: 100%% of LLC Agreement / Memorandum / Prospectus mentions found',
    async (n) => {
      const l = await load(
        `samples/sub-docs/raw/0${n}-partners-group-ngi-${n === 5 ? 2024 : 2026}.htm`,
      );
      const g = graphOf(l);
      const p = extractPrimaryFacts(g, l.hash);
      const report: Record<string, string> = {};
      let total = 0;
      for (const noun of E.ngi.recallNouns as string[]) {
        let t = 0;
        g.structure.blocks.forEach((_, i) => (t += truth(blockText(g, i), noun)));
        const found = p.references.filter((r) => r.targetLabel.endsWith(noun)).length;
        report[noun] = `${found}/${t}`;
        expect(found, noun).toBe(t);
        total += t;
      }
      expect(total).toBeGreaterThan(0);
      console.info(`NGI #${n} recall`, report);
    },
  );

  it('Hartwell: every seeded reference is found', async () => {
    const r = await runPackage([HARTWELL.sub, HARTWELL.lpa]);
    const keys = new Set(r.analysis.references.map((x) => x.targetLabel));
    for (const x of E.hartwell.references) expect(keys.has(x.label), x.label).toBe(true);
  });

  it.each(Object.keys(E.design))('design package %s: seeded targets all found', async (id) => {
    const e = E.design[id]!;
    const r = await runPackage(designFiles(id));
    const keys = new Set(r.analysis.references.map((x) => x.targetKey));
    const seeded = [...e.notInPackage, ...e.resolved];
    const found = seeded.filter((k: string) => keys.has(k)).length;
    expect(found).toBe(seeded.length);
  });
});
