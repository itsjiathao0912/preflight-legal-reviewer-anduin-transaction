import { describe, expect, it } from 'vitest';
import vectors from '../../../../fixtures/fingerprint-vectors.json' with { type: 'json' };
import { htmlToLines } from '../../src/adapters/html';
import { fingerprint, quoteHash } from '../../src/memory/fingerprint';
import { mask } from '../../src/memory/mask';
import { normalize } from '../../src/memory/normalize';

/** fingerprint-vectors (AC46): expected values computed outside core (Python hashlib). Node run; workerd/browser re-run in P04b/P03. */
describe('fingerprint-vectors', () => {
  it.each(vectors.normalize)('normalize: $name', (v) => {
    expect(normalize(v.input)).toBe(v.expected);
    expect(quoteHash(v.input)).toBe(v.quote_hash);
  });

  it.each(vectors.equal)('equal: $name', (v) => {
    expect(quoteHash(v.a)).toBe(quoteHash(v.b));
  });

  it.each(vectors.differ)('differ: $name', (v) => {
    expect(quoteHash(v.a)).not.toBe(quoteHash(v.b));
  });

  it.each(vectors.fingerprint)('fingerprint: $name', (v) => {
    expect(quoteHash(v.quote)).toBe(v.quote_hash);
    expect(fingerprint(v.firm, v.issue_class, v.quote_hash)).toBe(v.fingerprint);
  });

  it('firm A vs firm B and Section 4 vs 5 give different fingerprints', () => {
    const by = Object.fromEntries(vectors.fingerprint.map((v) => [v.name, v.fingerprint]));
    expect(by['firm-a']).not.toBe(by['firm-b']);
    expect(by['firm-a']).not.toBe(by['section-5']);
    expect(by['curly']).toBe(by['straight']);
  });

  it.each(vectors.length)('length boundary: $name', (v) => {
    const q = 'a'.repeat(v.length);
    if (v.accepted) expect(quoteHash(q)).toMatch(/^[0-9a-f]{64}$/);
    else expect(() => quoteHash(q)).toThrow();
  });

  it.each(vectors.mask)('should mask routing number to #last4 ($name)', (v) => {
    expect(mask(v.input, v.spans)).toBe(v.expected);
    expect(mask(v.input, v.spans)).not.toMatch(/#{2,}/);
  });

  it('021000021 and 1021000021 both mask to #0021 (no length leak)', () => {
    const [a, b] = vectors.mask;
    expect(mask(a!.input, a!.spans)).toBe(mask(b!.input, b!.spans));
  });

  it.each(vectors.cp1252)(
    'should normalize &#147; cp1252 entities and curly quotes to the straight-quote fingerprint ($name)',
    (v) => {
      const text = htmlToLines(v.html).lines[0]!.text;
      expect(text).toBe(v.expected_text);
      expect(normalize(text)).toBe(v.expected_normalized);
      expect(quoteHash(text)).toBe(v.quote_hash);
      if (v.straight) expect(quoteHash(v.straight)).toBe(quoteHash(text));
    },
  );
});
