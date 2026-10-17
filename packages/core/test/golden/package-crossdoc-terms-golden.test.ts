import { describe, expect, it } from 'vitest';
import { analyzed } from '../helpers/samples';
import {
  designFiles,
  expectedJson,
  HARTWELL,
  rolesOf,
  runPackage,
} from '../helpers/package-fixtures';

/** AC-I14/I15/I16 core halves. */
const E = expectedJson();
const roles = rolesOf;

describe('package-crossdoc-terms-golden (AC-I14, I15, I16)', () => {
  it('with the LPA: Units suppressed and listed defined_in_package with the definition quote; Stock stays', async () => {
    const r = await runPackage([HARTWELL.sub, HARTWELL.lpa, HARTWELL.prior]);
    const terms = Object.fromEntries(r.analysis.terms.map((t) => [t.term, t.status]));
    expect(terms).toEqual(E.hartwell.terms.withLpa);
    const units = r.analysis.terms.find((t) => t.term === 'Units')!;
    expect(units.quote).toBe(
      '“Units” means the limited partnership interests issued by the Partnership.',
    );
    const ut = r.findings.filter((f) => f.detector_id === 'undefined-term');
    expect(ut.map((f) => f.detail.facts.used_term)).toEqual(E.hartwell.findingsKept);
  });

  it('without the LPA: listed terms are unverified with reason no_reference_document; findings stay', async () => {
    const r = await runPackage([HARTWELL.sub, HARTWELL.prior]);
    expect(r.analysis.terms.length).toBeGreaterThan(0);
    for (const t of r.analysis.terms) {
      expect(t.status).toBe('unverified');
      expect(t.reason).toBe(E.hartwell.terms.withoutLpaReason);
    }
    const ut = r.findings
      .filter((f) => f.detector_id === 'undefined-term')
      .map((f) => f.detail.facts.used_term);
    expect(ut.sort()).toEqual(['Stock', 'Units']);
  });

  it('with an LPA lacking a term: not_in_reference_documents', async () => {
    const r = await runPackage([HARTWELL.sub, HARTWELL.lpa]);
    expect(r.analysis.terms.find((t) => t.term === 'Excused Investor')).toMatchObject({
      status: 'unverified',
      reason: 'not_in_reference_documents',
    });
  });

  it('sample #11 still flags Units (AC13 base)', () => {
    expect(analyzed(11).findings.filter((f) => f.detector_id === 'undefined-term')).toHaveLength(1);
  });

  it('northgate-iii: LPA-only terms are defined_in_package, never findings', async () => {
    const e = E.design['northgate-iii']!;
    const r = await runPackage(designFiles('northgate-iii'), { roles: roles(e.files) });
    for (const t of e.definedInPackage ?? [])
      expect(r.analysis.terms.find((x) => x.term === t)?.status, t).toBe('defined_in_package');
    // D3 offering-noun "Units" is not defined in the NG3 LPA, so its finding stays (answer key D3)
    expect(r.findings.some((f) => f.detector_id === 'undefined-term')).toBe(true);
  });

  it('lotus-bay-asia-ii (no LPA, PPM present): E1 terms unverified, not in the reference documents', async () => {
    const e = E.design['lotus-bay-asia-ii']!;
    const r = await runPackage(designFiles('lotus-bay-asia-ii'), { roles: roles(e.files) });
    for (const t of e.unverified ?? [])
      expect(
        r.analysis.terms.find((x) => x.term === t),
        t,
      ).toMatchObject({
        status: 'unverified',
        reason: 'not_in_reference_documents',
      });
    expect(r.findings.some((f) => f.detector_id === 'undefined-term')).toBe(false);
  });

  it('redwood-ridge-i: Subscription Facility defined in the LPA', async () => {
    const e = E.design['redwood-ridge-i']!;
    const r = await runPackage(designFiles('redwood-ridge-i'), { roles: roles(e.files) });
    for (const t of e.definedInPackage ?? [])
      expect(r.analysis.terms.find((x) => x.term === t)?.status, t).toBe('defined_in_package');
  });
});
