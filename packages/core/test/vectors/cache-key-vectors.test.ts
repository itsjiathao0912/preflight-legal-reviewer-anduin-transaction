import { describe, expect, it } from 'vitest';
import vectors from '../../../../fixtures/cache-key-vectors.json' with { type: 'json' };
import { cacheKey, type CacheKeyInput } from '../../src/contracts/cache-key';

describe('cache-key-vectors (AC27 key derivation)', () => {
  it.each(vectors.vectors)(
    'vector $input.kind/$input.model/$input.prompt_ver/$input.rules_hash',
    (v) => {
      expect(cacheKey(v.input as CacheKeyInput)).toBe(v.key);
    },
  );
  it('rejects components containing "|"', () => {
    for (const r of vectors.rejected) expect(() => cacheKey(r as CacheKeyInput)).toThrow();
  });
  it('every component changes the key', () => {
    const keys = new Set(vectors.vectors.map((v) => v.key));
    expect(keys.size).toBe(vectors.vectors.length);
  });
});
