import { describe, expect, it } from 'vitest';
import {
  detectDocument,
  mergeSuggestion,
  NO_MATCH_REASON,
  type DocTypeSuggester,
  type PackageDocument,
} from '../../src/package/index';
import { TASKS } from '../../src/llm/index';

const base: PackageDocument = {
  id: 'a'.repeat(64),
  name: 'x.pdf',
  type: 'other',
  role: 'reference',
  confidence: 'low',
  reason: NO_MATCH_REASON,
  confirmed: false,
  suggestionSource: 'rule',
  needsOcr: false,
  format: 'pdf',
  titleLines: [],
};
const fake: DocTypeSuggester = async () => ({ type: 'lpa', confidence: 'high' });

describe('package-suggester-seam (AC-I7, T2)', () => {
  it('detection completes with no suggester and no LLM task is registered for it', () => {
    expect(detectDocument({ name: 'x.pdf', titleLines: [], headText: '' }).type).toBe('other');
    expect(Object.keys(TASKS).some((k) => /doc-type|package/.test(k))).toBe(false);
  });

  it('applies an AI suggestion only when nothing else matched, always at low', async () => {
    const m = mergeSuggestion(base, await fake({ name: 'x', titleLines: [], headText: '' }));
    expect(m).toMatchObject({
      type: 'lpa',
      confidence: 'low',
      suggestionSource: 'ai',
      role: 'reference',
    });
  });

  it.each([
    [
      'confirmed analyst',
      { ...base, type: 'ppm' as const, confirmed: true, suggestionSource: 'analyst' as const },
    ],
    [
      'high rule',
      {
        ...base,
        type: 'ppm' as const,
        confidence: 'high' as const,
        reason: 'Title says "prospectus"',
      },
    ],
    ['low rule', { ...base, type: 'ppm' as const, reason: 'File name contains "ppm"' }],
    ['earlier AI', { ...base, type: 'ppm' as const, suggestionSource: 'ai' as const }],
  ])('a contradicting suggestion never overrides a %s value', async (_n, doc) => {
    const m = mergeSuggestion(doc, await fake({ name: 'x', titleLines: [], headText: '' }));
    expect(m).toEqual(doc);
  });

  it('a null suggestion changes nothing', () => {
    expect(mergeSuggestion(base, null)).toEqual(base);
  });
});
