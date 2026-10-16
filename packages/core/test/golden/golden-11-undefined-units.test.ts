import { describe, expect, it } from 'vitest';
import { analyzed } from '../helpers/samples';

describe('golden-11-undefined-units (AC13)', () => {
  const { findings } = analyzed(11);
  const dti = findings.filter((f) => f.issue_class === 'defined_term_issue');

  it('should flag offered Units as undefined term (defined: Shares)', () => {
    expect(dti).toHaveLength(1);
    const f = dti[0]!;
    expect(f.quote).toContain('offered Units');
    expect(f.detail.facts.used_term).toBe('Units');
    expect(f.detail.facts.defined_term).toBe('Shares');
    expect(f.severity).toBe('medium');
  });

  it('applies the Circular carve-out: severity capped at medium, two interpretations', () => {
    const f = dti[0]!;
    expect(f.detail.facts.carve_out).toBe('Circular');
    expect(f.detail.interpretations).toHaveLength(2);
    expect(f.detail.interpretations[0]).toMatch(/Circular/);
    expect(f.detail.interpretations[1]).toMatch(/drafting leftover/);
  });

  it('should flag only Units as defined_term_issue on sample 11', () => {
    expect(dti.map((f) => f.detail.facts.used_term)).toEqual(['Units']);
    expect(findings.filter((f) => f.issue_class === 'broken_cross_reference')).toHaveLength(0);
    // "Company" vs "REIT" and "Escrow Agent" stay unflagged
    expect(findings).toHaveLength(1);
  });

  it.each([5, 6])('negative: zero defined_term_issue on #%i', (n) => {
    expect(analyzed(n).findings.filter((f) => f.issue_class === 'defined_term_issue')).toHaveLength(
      0,
    );
  });
});
