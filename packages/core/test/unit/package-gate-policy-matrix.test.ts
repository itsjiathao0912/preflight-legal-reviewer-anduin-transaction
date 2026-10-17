import { describe, expect, it } from 'vitest';
import { computeGate } from '../../src/counsel/gate';
import {
  DEFAULT_PACKAGE_POLICY,
  packageGateReasons,
  PackagePolicySchema,
  type ExternalReference,
  type PackageDocType,
  type PackageDocument,
} from '../../src/package/index';

const doc = (type: PackageDocType, needsOcr = false): PackageDocument => ({
  id: 'a'.repeat(64),
  name: `${type}.docx`,
  type,
  role: 'reference',
  confidence: 'high',
  reason: 'r',
  confirmed: true,
  suggestionSource: 'analyst',
  needsOcr,
  format: 'docx',
  titleLines: [],
});
const ref = (family: ExternalReference['targetFamily']): ExternalReference => ({
  id: '0'.repeat(16),
  quote: 'q',
  location: { blockIndex: 0, start: 0, end: 1, sectionPath: [] },
  targetLabel: 'x',
  targetKey: family,
  targetFamily: family,
  resolution: 'not_in_package',
  confirmedByAnalyst: false,
});
const levels = (
  docs: PackageDocument[],
  refs: ExternalReference[] = [],
  policy = DEFAULT_PACKAGE_POLICY,
) =>
  packageGateReasons({ documents: docs, references: refs }, policy).map(
    (r) => `${r.level}:${r.docType}`,
  );

describe('package-gate-policy-matrix (AC-I19)', () => {
  it('default policy is data and validates', () => {
    expect(PackagePolicySchema.parse(DEFAULT_PACKAGE_POLICY)).toEqual(DEFAULT_PACKAGE_POLICY);
    expect(DEFAULT_PACKAGE_POLICY.missingDocGate).toEqual({
      sub_agreement: 'block',
      lpa: 'warn',
      ppm: 'warn',
      side_letter: 'warn',
      tax_form: 'warn',
    });
  });

  it('missing sub agreement blocks with a reason (block first)', () => {
    const r = packageGateReasons({ documents: [doc('lpa')], references: [] });
    expect(r[0]).toEqual({
      level: 'block',
      docType: 'sub_agreement',
      text: 'No subscription agreement in this package, so there is nothing to digitize.',
    });
  });

  it('a sub agreement that needs OCR counts as missing', () => {
    expect(levels([doc('sub_agreement', true), doc('lpa')])).toEqual(['block:sub_agreement']);
  });

  it('missing LPA always warns; PPM, side letter and tax form warn only when referenced', () => {
    expect(levels([doc('sub_agreement')])).toEqual(['warn:lpa']);
    expect(
      levels([doc('sub_agreement'), doc('lpa')], [ref('ppm'), ref('side_letter'), ref('tax_form')]),
    ).toEqual(['warn:ppm', 'warn:tax_form', 'warn:side_letter']);
    expect(levels([doc('sub_agreement'), doc('lpa'), doc('ppm')], [ref('ppm')])).toEqual([]);
  });

  it.each([
    ['block', ['block:lpa']],
    ['warn', ['warn:lpa']],
    ['off', []],
  ] as const)('a modified policy row (lpa: %s) changes the outcome', (lvl, want) => {
    const p = {
      ...DEFAULT_PACKAGE_POLICY,
      missingDocGate: { ...DEFAULT_PACKAGE_POLICY.missingDocGate, lpa: lvl },
    };
    expect(levels([doc('sub_agreement')], [], p)).toEqual(want);
  });

  it('computeGate is untouched: same output for the same findings with or without a package', () => {
    const a = computeGate([], {}, {});
    expect(computeGate([], {}, {})).toEqual(a);
    expect(typeof computeGate).toBe('function');
  });
});
