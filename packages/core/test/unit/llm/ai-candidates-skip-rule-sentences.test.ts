// AC9 (ai-review-stream-dedup D3a): AI candidates never repeat a sentence a rule finding already
// anchors; surviving candidates keep their ids and hints.
import { describe, expect, it } from 'vitest';
import { analyzeHtml } from '../../../src/engine';
import type { Finding } from '../../../src/findings/schema';
import { buildAiCandidatesWithSites, type AiCandidateSite } from '../../../src/llm/candidates';
import { rangesOverlap } from '../../../src/llm/dedupe';
import { analyzed } from '../../helpers/samples';

const g = analyzeHtml(`<html><body><p><b>1. TERMS</b></p>
<p>"Accredited Investor" means a person described in Rule 501. If the investor is an IRA, see Annex Z.</p>
</body></html>`);
const block = g.structure.blocks.find((b) => b.lines.some((l) => l.text.includes('Accredited')))!;
const text = block.lines.map((l) => l.text).join(' ');
const condAt = text.indexOf('If the investor');

function rule(start: number, end: number, kind: 'rule' | 'ai' = 'rule', blockId = block.id) {
  return {
    detector_kind: kind,
    issue_class: 'broken_reference',
    anchor: { docHash: g.structure.docHash, blockId, offsetStart: start, offsetEnd: end },
  } as unknown as Finding;
}

const build = (fs: Finding[], max?: number) => buildAiCandidatesWithSites(g, fs, max);
const baseline = build([]);

function overlapsAny(site: AiCandidateSite, fs: readonly Finding[]): boolean {
  const b = g.structure.blocks[site.blockIndex]!;
  return fs.some(
    (f) =>
      f.detector_kind === 'rule' &&
      f.anchor.blockId === b.id &&
      rangesOverlap(site.start, site.end, f.anchor.offsetStart, f.anchor.offsetEnd),
  );
}

describe('ai-candidates-skip-rule-sentences (AC9)', () => {
  it('baseline: one definition and one conditional candidate', () => {
    expect(baseline.candidates.map((c) => c.issue_class_hint)).toEqual([
      'defined_term_issue',
      'broken_conditional',
    ]);
  });

  it('should exclude sentences already flagged by a rule finding from AI candidates', () => {
    const out = build([rule(0, 10)]);
    expect(out.candidates).toEqual([baseline.candidates[1]]);
    expect(out.sites).toEqual([baseline.sites[1]]);
  });

  it('a rule anchor inside the conditional sentence removes only that sentence', () => {
    const out = build([rule(condAt + 5, condAt + 9)]);
    expect(out.candidates).toEqual([baseline.candidates[0]]);
  });

  it('a rule anchor spanning both sentences excludes both', () => {
    expect(build([rule(10, condAt + 3)]).candidates).toEqual([]);
  });

  it('a zero-length rule anchor counts as one character', () => {
    expect(build([rule(condAt + 2, condAt + 2)]).candidates).toEqual([baseline.candidates[0]]);
  });

  it('two rule findings in the same block exclude both sentences', () => {
    expect(build([rule(1, 2), rule(condAt + 1, condAt + 2)]).candidates).toEqual([]);
  });

  it('anchors past the text length or with hostile numbers never throw and exclude nothing', () => {
    expect(build([rule(5000, 6000), rule(Number.NaN, 3)]).candidates).toEqual(baseline.candidates);
  });

  it('non-rule findings and rule findings of other blocks never exclude', () => {
    expect(
      build([rule(0, 10, 'ai'), rule(0, 10, 'rule', g.structure.blocks[0]!.id)]).candidates,
    ).toEqual(baseline.candidates);
  });

  it('the cap is still honored', () => {
    expect(build([], 1).candidates).toHaveLength(1);
  });

  for (const n of [1, 3]) {
    it(`sample ${n}: no candidate overlaps a rule anchor; survivors keep id, quote and hint`, () => {
      const { g: sg, findings } = analyzed(n);
      const now = buildAiCandidatesWithSites(sg, findings);
      const all = buildAiCandidatesWithSites(sg, []);
      const sameBlock = (site: AiCandidateSite) => {
        const b = sg.structure.blocks[site.blockIndex]!;
        return findings.some(
          (f) =>
            f.detector_kind === 'rule' &&
            f.anchor.blockId === b.id &&
            rangesOverlap(site.start, site.end, f.anchor.offsetStart, f.anchor.offsetEnd),
        );
      };
      expect(now.sites.some(sameBlock)).toBe(false);
      const expected = all.candidates.filter((_, i) => !sameBlock(all.sites[i]!));
      expect(now.candidates).toEqual(expected);
      expect(now.candidates.length).toBeGreaterThan(0);
    });
  }

  it('helper sanity: overlapsAny agrees with the builder on the synthetic doc', () => {
    const fs = [rule(0, 10)];
    expect(build(fs).sites.some((s) => overlapsAny(s, fs))).toBe(false);
  });
});
