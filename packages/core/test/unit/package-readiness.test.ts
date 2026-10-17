import { describe, expect, it } from 'vitest';
import { packageRunReadiness, type PackageDocument } from '../../src/package/index';

const doc = (id: string, over: Partial<PackageDocument> = {}): PackageDocument => ({
  id: id.repeat(64),
  name: `${id}.docx`,
  type: 'sub_agreement',
  role: 'to_digitize',
  confidence: 'high',
  reason: 'Title says "subscription agreement"',
  confirmed: false,
  suggestionSource: 'rule',
  needsOcr: false,
  format: 'docx',
  titleLines: [],
  ...over,
});

describe('package-readiness (AC-I6 core)', () => {
  it('ok with exactly one to_digitize and no unconfirmed low rows', () => {
    expect(packageRunReadiness([doc('a'), doc('b', { type: 'lpa', role: 'reference' })])).toEqual({
      ok: true,
      problems: [],
    });
  });

  it('flags each unconfirmed low row', () => {
    const r = packageRunReadiness([
      doc('a'),
      doc('b', { type: 'lpa', role: 'reference', confidence: 'low' }),
    ]);
    expect(r).toEqual({
      ok: false,
      problems: [{ code: 'low_confidence_unconfirmed', docId: 'b'.repeat(64) }],
    });
  });

  it('a confirmed low row is fine', () => {
    expect(packageRunReadiness([doc('a', { confidence: 'low', confirmed: true })]).ok).toBe(true);
  });

  it('flags no_to_digitize and multiple_to_digitize', () => {
    expect(packageRunReadiness([doc('a', { role: 'reference' })]).problems).toEqual([
      { code: 'no_to_digitize' },
    ]);
    expect(packageRunReadiness([doc('a'), doc('b')]).problems).toEqual([
      { code: 'multiple_to_digitize' },
    ]);
  });
});
