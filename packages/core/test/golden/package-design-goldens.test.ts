import { describe, expect, it } from 'vitest';
import { runDeterministic } from '../../src/engine';
import type { Finding } from '../../src/findings/schema';
import { analyzed, htmlSamples } from '../helpers/samples';
import { graphOf, load } from '../helpers/package-fixtures';

/**
 * AC-S3, AC-S4 (intake T14). Reads the committed copies under fixtures/package/design/** (never
 * samples/packages/**). Literals measured at Step B0.7 (before/after table in the Phase 1 report).
 */
const D = 'fixtures/package/design';

async function run(rel: string) {
  const g = graphOf(await load(rel));
  const findings = runDeterministic(g);
  const counts: Record<string, number> = {};
  for (const f of findings)
    counts[`${f.detector_id}|${f.severity}`] = (counts[`${f.detector_id}|${f.severity}`] ?? 0) + 1;
  return { g, findings, counts, sections: g.structure.scopes.flatMap((s) => s.sections) };
}
const bc = (fs: Finding[]) => fs.filter((f) => f.detector_id === 'broken-conditional');

describe('package-design-goldens (AC-S3)', () => {
  it('should pin measured section counts and answer-key findings for LB2, RR1, NG3, NG2 and both LPAs', async () => {
    // LB2 offshore v2: Section N. headings now found (0 before B0); Annex C is not a conditional target
    const lb2 = await run(`${D}/lotus-bay-asia-ii/01-LB2-Subscription-Agreement-Offshore-v2.docx`);
    expect(lb2.sections.map((s) => s.number)).toEqual(
      Array.from({ length: 15 }, (_, i) => String(i + 1)),
    );
    expect(lb2.counts).toEqual({
      'defined-term-issues|medium': 2,
      'defined-term-issues|high': 2,
      'flag-placeholder|medium': 1,
      'flag-sensitive|medium': 2,
    });
    expect(bc(lb2.findings)).toHaveLength(0);
    expect(
      lb2.findings.some((f) => f.detector_id === 'flag-placeholder' && f.quote.includes('[●]')),
    ).toBe(true); // E8
    expect(lb2.findings.filter((f) => f.detector_id === 'flag-sensitive')).toHaveLength(2); // E9

    // RR1 agreement: F1 skip to Question 15 caught; F7, F8, F10 still caught; F3 measured silent (known gap)
    const rr1 = await run(`${D}/redwood-ridge-i/01-RR1-Subscription-Agreement.docx`);
    expect(rr1.sections).toHaveLength(13);
    expect(rr1.counts).toEqual({
      'flag-placeholder|medium': 1,
      'broken-conditional|critical': 1,
      'flag-drafting-note|medium': 1,
      'flag-sensitive|medium': 2,
    });
    expect(bc(rr1.findings)[0]!.quote).toContain('skip to Question 15');
    expect(bc(rr1.findings)[0]!.detail.facts.missing).toBe('Question 15');
    expect(rr1.findings.some((f) => f.issue_class === 'broken_cross_reference')).toBe(false); // F3 gap: measured

    // NG3 sub agreement: D6 complete Annex F now critical broken-conditional; D1-D5, D10 unchanged
    const ng3 = await run(`${D}/northgate-iii/01-NG3-Subscription-Agreement.docx`);
    expect(ng3.sections).toHaveLength(15);
    expect(ng3.counts).toEqual({
      'undefined-term|medium': 1,
      'ref-label-coherence|high': 1,
      'flag-placeholder|medium': 1,
      'flag-drafting-note|medium': 1,
      'broken-conditional|critical': 1,
      'ref-this-section|high': 1,
      'flag-sensitive|medium': 1,
    });
    expect(bc(ng3.findings)[0]!.quote).toContain('complete Annex F');

    // NG2 baseline: same Annex F finding (5 findings before B0, 6 after; table row NG2-annexF)
    const ng2 = await run(`${D}/northgate-iii/04-NG2-Subscription-Agreement-2024.docx`);
    expect(ng2.sections).toHaveLength(14);
    expect(ng2.findings).toHaveLength(6);
    expect(bc(ng2.findings)[0]!.detail.facts.missing).toBe('Annex F');

    // LPAs: Article headings; defined-term counts pinned as measured (unrelated to B0)
    const ng3lpa = await run(`${D}/northgate-iii/02-NG3-LPA-Definitions-and-Key-Terms.docx`);
    expect(ng3lpa.sections.map((s) => s.number)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(ng3lpa.counts).toEqual({ 'defined-term-issues|medium': 3 });
    const rr1lpa = await run(`${D}/redwood-ridge-i/02-RR1-LPA-Definitions.docx`);
    expect(rr1lpa.sections.map((s) => s.number)).toEqual(['1']);
    expect(rr1lpa.counts).toEqual({
      'defined-term-issues|medium': 13,
      'defined-term-issues|high': 1,
    });
  });

  it('Harbourline W-8 guide: Annex B with no annex labels stays uncertain (no finding)', async () => {
    const h = await run(`${D}/lotus-bay-asia-ii/06-Harbourline-W8-Guide.docx`);
    expect(h.sections).toHaveLength(9);
    expect(bc(h.findings)).toHaveLength(0);
  });
});

/** Post-B0.7 corpus table: [findings, sections, conditionals]; identical findings to P1_BASE. */
const CORPUS: Record<string, [number, number, number]> = {
  '01-franklin-lexington-pmf-2024.htm': [4, 13, 0],
  '02-coatue-innovation-fund-2025.htm': [18, 0, 0],
  '03-partners-group-pe-master-2019.htm': [5, 12, 3],
  '04-partners-group-pe-tei-2016.htm': [3, 9, 0],
  '05-partners-group-ngi-2024.htm': [7, 12, 3],
  '06-partners-group-ngi-2026.htm': [3, 12, 3],
  '07-cottonwood-multifamily-reit-ii-2016.htm': [4, 7, 1],
  '08-modiv-reit-2021.htm': [0, 9, 0],
  '10-crowdstreet-reit-i-2022.htm': [5, 1, 0],
  '11-medalist-diversified-reit-2016.htm': [1, 3, 0],
  '12-fortress-net-lease-reit-2024.htm': [1, 9, 1], // +1 conditional "complete ... Annex D" (Annex D exists: silent)
  '13-blackstone-reit-2024-appendix-b.htm': [2, 9, 1],
};

describe('package-design-goldens corpus regression (AC-S4)', () => {
  it('should keep the 12-sample corpus counts equal to the post-B0.7 table', () => {
    expect(htmlSamples()).toEqual(Object.keys(CORPUS).sort());
    for (const f of htmlSamples()) {
      const { g, findings } = analyzed(f);
      const got: [number, number, number] = [
        findings.length,
        g.structure.scopes.reduce((n, s) => n + s.sections.length, 0),
        g.structure.conditionals.length,
      ];
      expect(got, f).toEqual(CORPUS[f]);
    }
  });
});
