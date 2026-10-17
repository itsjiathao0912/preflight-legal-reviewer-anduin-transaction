import { describe, expect, it } from 'vitest';
import { analyzed, htmlSamples } from '../helpers/samples';

/**
 * Intake Phase 1 Step A (premise check, INNOVATE finding 1). Literals measured at P1_BASE
 * (1f17967) before any intake code: `undefined-term` fires only on #11 ("Units"); the other
 * defined-term findings come from `defined-term-issues`.
 */
const EXPECTED: Record<
  string,
  { undefinedTerms: string[]; dtiByDetector: Record<string, number> }
> = {
  '01-franklin-lexington-pmf-2024.htm': { undefinedTerms: [], dtiByDetector: {} },
  '02-coatue-innovation-fund-2025.htm': {
    undefinedTerms: [],
    dtiByDetector: { 'defined-term-issues': 5 },
  },
  '03-partners-group-pe-master-2019.htm': { undefinedTerms: [], dtiByDetector: {} },
  '04-partners-group-pe-tei-2016.htm': {
    undefinedTerms: [],
    dtiByDetector: { 'defined-term-issues': 2 },
  },
  '05-partners-group-ngi-2024.htm': { undefinedTerms: [], dtiByDetector: {} },
  '06-partners-group-ngi-2026.htm': { undefinedTerms: [], dtiByDetector: {} },
  '07-cottonwood-multifamily-reit-ii-2016.htm': {
    undefinedTerms: [],
    dtiByDetector: { 'defined-term-issues': 3 },
  },
  '08-modiv-reit-2021.htm': { undefinedTerms: [], dtiByDetector: {} },
  '10-crowdstreet-reit-i-2022.htm': {
    undefinedTerms: [],
    dtiByDetector: { 'defined-term-issues': 5 },
  },
  '11-medalist-diversified-reit-2016.htm': {
    undefinedTerms: ['Units'],
    dtiByDetector: { 'undefined-term': 1 },
  },
  '12-fortress-net-lease-reit-2024.htm': {
    undefinedTerms: [],
    dtiByDetector: { 'defined-term-issues': 1 },
  },
  '13-blackstone-reit-2024-appendix-b.htm': { undefinedTerms: [], dtiByDetector: {} },
};

describe('package-undefined-term-baseline (premise check)', () => {
  it('covers exactly the 12 HTML samples', () => {
    expect(htmlSamples()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.keys(EXPECTED))('should pin undefined-term and defined_term_issue on %s', (f) => {
    const { findings } = analyzed(f);
    const ut = findings
      .filter((x) => x.detector_id === 'undefined-term')
      .map((x) => String(x.detail.facts.used_term))
      .sort();
    const dti: Record<string, number> = {};
    for (const x of findings.filter((y) => y.issue_class === 'defined_term_issue'))
      dti[x.detector_id] = (dti[x.detector_id] ?? 0) + 1;
    expect(ut).toEqual(EXPECTED[f]!.undefinedTerms);
    expect(dti).toEqual(EXPECTED[f]!.dtiByDetector);
  });
});
