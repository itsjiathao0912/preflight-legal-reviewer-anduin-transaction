import { describe, expect, it } from 'vitest';
import {
  CONFIRMED_NONE,
  DOC_SYNONYMS,
  resolveReferences,
  type PackageDocument,
  type PackageFacts,
  type RawReference,
  type TargetFamily,
} from '../../src/package/index';

const P = '0'.repeat(64);
const doc = (c: string, over: Partial<PackageDocument>): PackageDocument => ({
  id: c.repeat(64),
  name: `${c}.docx`,
  type: 'lpa',
  role: 'reference',
  confidence: 'high',
  reason: 'Title says "limited partnership agreement"',
  confirmed: false,
  suggestionSource: 'rule',
  needsOcr: false,
  format: 'docx',
  titleLines: [],
  ...over,
});
const primary = doc('0', { type: 'sub_agreement', role: 'to_digitize' });
const raw = (label: string, family: TargetFamily, key = family as string): RawReference => ({
  quote: `See the ${label}.`,
  location: { blockIndex: 1, start: 8, end: 8 + label.length, sectionPath: [] },
  targetLabel: label,
  targetKey: key,
  targetFamily: family,
});
const res = (r: RawReference, docs: PackageDocument[], facts: PackageFacts[] = [], conf = {}) =>
  resolveReferences([r], [primary, ...docs], facts, conf, P)[0]!;

describe('package-reference-resolution-matrix (AC-I12)', () => {
  it.each(['Partnership Agreement', 'LP Agreement', 'Fund Agreement', 'LLC Agreement'])(
    'synonym %s resolves to the single LPA',
    (label) => {
      expect(DOC_SYNONYMS.lpa).toContain(label.toLowerCase());
      expect(res(raw(label, 'lpa'), [doc('a', {})])).toMatchObject({
        resolution: 'resolved',
        resolvedDocId: 'a'.repeat(64),
        confirmedByAnalyst: false,
      });
    },
  );

  it('missing target gives not_in_package', () => {
    expect(res(raw('Prospectus', 'ppm'), [doc('a', {})]).resolution).toBe('not_in_package');
  });

  it('two LPAs give unclear (never guessed)', () => {
    expect(res(raw('Partnership Agreement', 'lpa'), [doc('a', {}), doc('b', {})]).resolution).toBe(
      'unclear',
    );
  });

  it('one low unconfirmed candidate gives unclear; confirmed gives resolved', () => {
    expect(
      res(raw('Partnership Agreement', 'lpa'), [doc('a', { confidence: 'low' })]).resolution,
    ).toBe('unclear');
    expect(
      res(raw('Partnership Agreement', 'lpa'), [doc('a', { confidence: 'low', confirmed: true })])
        .resolution,
    ).toBe('resolved');
  });

  it('annex targets resolve by title, heading or file name', () => {
    const annexDoc = doc('c', { type: 'other', name: 'Annex-F-ERISA.docx' });
    expect(res(raw('Annex F', 'annex', 'annex:annex f'), [annexDoc]).resolution).toBe('resolved');
    const titled = doc('d', { type: 'other', titleLines: ['ANNEX C. CAYMAN AML SCHEDULE'] });
    expect(res(raw('Annex C', 'annex', 'annex:annex c'), [titled]).resolution).toBe('resolved');
    expect(res(raw('Annex C', 'annex', 'annex:annex c'), [annexDoc]).resolution).toBe(
      'not_in_package',
    );
  });

  it('the primary document never resolves its own reference', () => {
    expect(
      resolveReferences([raw('Subscription', 'lpa')], [doc('0', {})], [], {}, P)[0]!.resolution,
    ).toBe('not_in_package');
  });

  it('confirmedTargets override: a doc id resolves, "none" is not_in_package; both set confirmedByAnalyst', () => {
    const two = [doc('a', {}), doc('b', {})];
    expect(res(raw('LP Agreement', 'lpa'), two, [], { lpa: 'b'.repeat(64) })).toMatchObject({
      resolution: 'resolved',
      resolvedDocId: 'b'.repeat(64),
      confirmedByAnalyst: true,
    });
    expect(res(raw('LP Agreement', 'lpa'), two, [], { lpa: CONFIRMED_NONE })).toMatchObject({
      resolution: 'not_in_package',
      confirmedByAnalyst: true,
    });
  });

  it('ids are stable 16-hex values', () => {
    const a = res(raw('PPM', 'ppm'), []);
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
    expect(res(raw('PPM', 'ppm'), []).id).toBe(a.id);
  });
});
