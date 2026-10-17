import { describe, expect, it } from 'vitest';
import {
  computeCoverage,
  coverageLineText,
  type CrossDocTerm,
  type ExternalReference,
  type PackageDocType,
  type PackageDocument,
} from '../../src/package/index';

const doc = (type: PackageDocType, over: Partial<PackageDocument> = {}): PackageDocument => ({
  id: String(type.length)
    .repeat(64)
    .slice(0, 64)
    .padEnd(64, '0')
    .replace(/[^0-9a-f]/g, 'a'),
  name: `${type}.docx`,
  type,
  role: type === 'sub_agreement' ? 'to_digitize' : 'reference',
  confidence: 'high',
  reason: 'r',
  confirmed: true,
  suggestionSource: 'analyst',
  needsOcr: false,
  format: 'docx',
  titleLines: [],
  ...over,
});
const ref = (resolution: ExternalReference['resolution']): ExternalReference => ({
  id: '0'.repeat(16),
  quote: 'q',
  location: { blockIndex: 0, start: 0, end: 1, sectionPath: [] },
  targetLabel: 'Side Letter',
  targetKey: 'side_letter',
  targetFamily: 'side_letter',
  resolution,
  confirmedByAnalyst: false,
});
const term = (status: CrossDocTerm['status']): CrossDocTerm => ({
  term: 'T' + Math.random(),
  status,
  mentions: 2,
});
const line = (
  docs: PackageDocument[],
  refs: ExternalReference[] = [],
  terms: CrossDocTerm[] = [],
) => coverageLineText({ coverage: computeCoverage(docs, refs, terms) });
const statuses = (
  docs: PackageDocument[],
  refs: ExternalReference[] = [],
  terms: CrossDocTerm[] = [],
) => Object.fromEntries(computeCoverage(docs, refs, terms).map((g) => [g.id, g.status]));

describe('package-coverage-matrix (AC-I17)', () => {
  it('full when the sub agreement and the LPA are present and nothing is open', () => {
    expect(line([doc('sub_agreement'), doc('lpa')])).toBe('Coverage: full');
  });

  it('fixed group order and labels', () => {
    expect(
      computeCoverage([doc('sub_agreement'), doc('lpa')], [], []).map((g) => [g.id, g.label]),
    ).toEqual([
      ['structure_flow', 'Structure and flow'],
      ['internal_refs', 'Internal cross-references'],
      ['defined_terms', 'Defined terms'],
      ['external_refs', 'External references'],
      ['investor_paths', 'Investor paths'],
    ]);
  });

  it('no LPA: defined terms partial with "no LPA"', () => {
    const terms = Array.from({ length: 14 }, () => term('unverified'));
    expect(statuses([doc('sub_agreement')], [], terms).defined_terms).toBe('partial');
    expect(line([doc('sub_agreement')], [], terms)).toBe(
      'Coverage: partial - no LPA, 14 terms unverified',
    );
  });

  it('missing sub agreement blocks every group', () => {
    const g = computeCoverage([doc('lpa')], [], []);
    expect(g.every((x) => x.status === 'blocked' && x.missingTypes[0] === 'sub_agreement')).toBe(
      true,
    );
    expect(line([doc('lpa')])).toBe('Coverage: blocked - no subscription agreement');
  });

  it('a sub agreement that needs OCR blocks with the OCR reason', () => {
    expect(line([doc('sub_agreement', { needsOcr: true }), doc('lpa')])).toBe(
      'Coverage: blocked - subscription agreement has no readable text (needs OCR), needs OCR',
    );
  });

  it('references not in the package and to confirm make external refs partial', () => {
    const refs = [ref('not_in_package'), ref('not_in_package'), ref('unclear')];
    expect(statuses([doc('sub_agreement'), doc('lpa')], refs).external_refs).toBe('partial');
    expect(line([doc('sub_agreement'), doc('lpa')], refs)).toBe(
      'Coverage: partial - 2 references not in the package, 1 reference to confirm',
    );
  });

  it('an LPA that needs OCR is partial; reasons cap at 3 then +N more', () => {
    const docs = [doc('sub_agreement'), doc('lpa', { needsOcr: true })];
    expect(line(docs, [ref('not_in_package'), ref('unclear')], [term('unverified')])).toBe(
      'Coverage: partial - needs OCR, 1 term unverified, 1 reference not in the package, +1 more',
    );
  });
});
