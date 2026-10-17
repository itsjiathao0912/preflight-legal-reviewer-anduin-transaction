import { describe, expect, it } from 'vitest';
import { OWNERS, parseQuestionKey, questionKey, runVariance } from '../../src/variance/index';
import { demoPair } from '../helpers/variance';

/**
 * AC-V12 (core): a change finding's question key is `<findingId>@<owner>`; an error finding keeps
 * its plain id; ids that contain "@" stay intact; one helper is used everywhere.
 */
describe('variance-question-key-matrix', () => {
  it('should key change questions as findingId@owner and keep the plain id for error findings', () => {
    const ids = ['f_0123abcd', 'f_x', 'id@with@at', 'trailing@', 'x@gpx'];
    for (const id of ids) {
      expect(questionKey(id)).toBe(id);
      expect(parseQuestionKey(questionKey(id))).toEqual({ findingId: id });
      for (const o of OWNERS) {
        const k = questionKey(id, o);
        expect(k).toBe(`${id}@${o}`);
        expect(parseQuestionKey(k)).toEqual({ findingId: id, owner: o });
      }
    }
  });

  it('gives a two-owner change two keys and every demo key round-trips', () => {
    const r = runVariance(demoPair());
    const keys = r.findings.flatMap((f) => r.meta[f.id]!.owners.map((o) => questionKey(f.id, o)));
    expect(keys).toHaveLength(8); // 7 changes, Singapore has GP and counsel
    expect(new Set(keys).size).toBe(8);
    for (const k of keys)
      expect(questionKey(parseQuestionKey(k).findingId, parseQuestionKey(k).owner)).toBe(k);
  });

  it('rejects an empty id and an unknown owner', () => {
    expect(() => questionKey('')).toThrow();
    expect(() => questionKey('f_1', 'partner' as never)).toThrow();
    expect(parseQuestionKey('@counsel')).toEqual({ findingId: '@counsel' });
  });
});
