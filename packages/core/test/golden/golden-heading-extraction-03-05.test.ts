import { describe, expect, it } from 'vitest';
import { analyzed } from '../helpers/samples';

const EXPECTED = [
  'TYPE OF ACCOUNT',
  'INVESTOR INFORMATION',
  'ADDRESS',
  'CUSTODIAN INFORMATION',
  'FINANCIAL ADVISOR INFORMATION',
  'INVESTMENT DETAILS',
  'DISTRIBUTIONS',
  'DELIVERY OF DOCUMENTS',
  'INTERNAL REVENUE CODE CERTIFICATION',
  'QUALIFIED INVESTOR DETERMINATION',
  'COST BASIS ELECTION',
  'ACKNOWLEDGEMENT AND SIGNATURE',
];

describe.each([3, 5])('golden-heading-extraction-03-05 (sample #%i)', (n) => {
  const { g } = analyzed(n);
  const sig = g.structure.scopes.find((s) => s.kind === 'signature')!;

  it('should accept sections 1-12 with titles on samples 3 and 5 (table-level bold, parenthetical caps)', () => {
    expect(sig).toBeDefined();
    expect(sig.sections.map((s) => s.number)).toEqual([
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
      '11',
      '12',
    ]);
    sig.sections.forEach((s, i) =>
      expect(s.title.toUpperCase().startsWith(EXPECTED[i]!)).toBe(true),
    );
    expect(sig.sections.every((s) => !s.gap)).toBe(true);
  });

  it('section 4 is CUSTODIAN INFORMATION with no Part B; section 6 INVESTMENT DETAILS has Parts A and B', () => {
    const s4 = sig.sections.find((s) => s.number === '4')!;
    expect(s4.title).toMatch(/^CUSTODIAN INFORMATION/);
    expect(s4.parts).toHaveLength(0);
    const s6 = sig.sections.find((s) => s.number === '6')!;
    expect(s6.title).toBe('INVESTMENT DETAILS');
    expect(s6.parts.map((p) => p.letter)).toEqual(['A', 'B']);
    expect(s6.parts[1]!.label).toBe('Investment amount');
  });

  it('numbered instruction, terms and appendix lists never become sections', () => {
    for (const s of g.structure.scopes) if (s !== sig) expect(s.sections).toHaveLength(0);
  });
});
