import { describe, expect, it } from 'vitest';
import {
  assertionCandidateOf,
  describeAssertion,
  loadVarianceRules,
  normalizeAssertionLabel,
  runRegressionChecks,
  varianceMetaOf,
  type RegressionCheck,
} from '../../src/variance/index';
import { vside } from '../helpers/variance';

/**
 * AC-V16 (core): the `scope_exists` runner. Violated (Fund III lacks Appendix C) gives one
 * critical regression finding "Regression: confirmed in Fund II" with the check statement as the
 * quote; held (the with-Appendix-C variant) gives none. Called directly via `runRegressionChecks`
 * (runVariance never runs checks).
 */
const check: RegressionCheck = {
  kind: 'scope_exists',
  label: 'Appendix C',
  statement: 'Appendix C must exist',
  sourceFundName: 'Fund II',
};

describe('variance-regression-scope-exists', () => {
  it('should raise a critical regression finding when Appendix C is missing and none when present', () => {
    const fund3 = vside('hartwell-crane/fund-III.html', 'Fund III').structure;
    const out = runRegressionChecks(fund3, [check]);
    expect(out).toHaveLength(1);
    const f = out[0]!;
    expect(f).toMatchObject({
      issue_class: 'version_drift',
      severity: 'critical',
      detector_kind: 'rule',
      detector_id: 'variance.regression.scope_exists',
      pattern_key: 'VAR-REG-SCOPE-EXISTS',
      quote: 'Appendix C must exist',
    });
    expect(f.detail.explanation.startsWith('Regression: confirmed in Fund II.')).toBe(true);
    const m = varianceMetaOf(f)!;
    expect(m).toMatchObject({
      kind: 'regression',
      change_type: 'regression',
      title: 'Regression: confirmed in Fund II',
      assertion_candidate: { kind: 'scope_exists', label: 'appendix c' },
    });
    const held = vside('hartwell-crane/fund-III-with-appendix-c.html', 'Fund III').structure;
    expect(runRegressionChecks(held, [check])).toEqual([]);
  });

  it('normalizes labels identically (case, spacing, scope title) and previews the assertion', () => {
    for (const l of [
      'Appendix C',
      'appendix c',
      'APPENDIX  C',
      'SUBSCRIPTION AGREEMENT – APPENDIX C',
    ])
      expect(normalizeAssertionLabel(l)).toBe('appendix c');
    expect(normalizeAssertionLabel('Exhibit 12')).toBe('exhibit 12');
    expect(normalizeAssertionLabel('Privacy Notice!')).toBe('privacy notice');
    expect(normalizeAssertionLabel('x'.repeat(300)).length).toBeLessThanOrEqual(80);
    expect(describeAssertion({ kind: 'scope_exists', label: 'appendix c' })).toBe(
      'Appendix C must exist',
    );
    expect(describeAssertion({ kind: 'scope_exists', label: 'APPENDIX  c' })).toBe(
      'Appendix C must exist',
    );
  });

  it('offers a candidate only for a wholly removed or added appendix scope unit', () => {
    const base = {
      unitKind: 'scope',
      unitKey: 'appendix:c',
      title: 'SUBSCRIPTION AGREEMENT – APPENDIX C',
    };
    expect(assertionCandidateOf({ ...base, status: 'removed' })).toEqual({
      kind: 'scope_exists',
      label: 'appendix c',
    });
    expect(assertionCandidateOf({ ...base, status: 'added' })).toEqual({
      kind: 'scope_exists',
      label: 'appendix c',
    });
    expect(assertionCandidateOf({ ...base, status: 'changed' })).toBeUndefined();
    expect(
      assertionCandidateOf({
        ...base,
        status: 'removed',
        unitKind: 'section',
        unitKey: 'appendix:c/s1',
      }),
    ).toBeUndefined();
    expect(assertionCandidateOf({ ...base, status: 'removed', unitKey: 'body:1' })).toBeUndefined();
  });

  it('dedupes checks, ignores checks beyond the per-firm cap and other kinds', () => {
    const fund3 = vside('hartwell-crane/fund-III.html', 'Fund III').structure;
    expect(runRegressionChecks(fund3, [check, { ...check, label: 'appendix  c' }])).toHaveLength(1);
    const cap = loadVarianceRules().config.regression.max_checks_per_firm;
    const many = Array.from({ length: cap }, (_, i) => ({
      ...check,
      label: `Appendix A`,
      statement: `s${i}`,
    }));
    expect(runRegressionChecks(fund3, [...many, check])).toEqual([]); // check #21 is beyond the cap
    expect(runRegressionChecks(fund3, [{ ...check, kind: 'other' as never }])).toEqual([]);
  });
});
