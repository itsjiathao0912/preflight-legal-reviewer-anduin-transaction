// fingerprint-vectors in workerd (closes the Phase 01 carried gap): same expected values as Node.
import { fingerprint, htmlToLines, mask, normalize, quoteHash } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import vectors from '../../../../fixtures/fingerprint-vectors.json' with { type: 'json' };

describe('fingerprint-vectors (workerd, AC46)', () => {
  it.each(vectors.normalize)('normalize: $name', (v) => {
    expect(normalize(v.input)).toBe(v.expected);
    expect(quoteHash(v.input)).toBe(v.quote_hash);
  });
  it.each(vectors.equal)('equal: $name', (v) => expect(quoteHash(v.a)).toBe(quoteHash(v.b)));
  it.each(vectors.differ)('differ: $name', (v) => expect(quoteHash(v.a)).not.toBe(quoteHash(v.b)));
  it.each(vectors.fingerprint)('fingerprint: $name', (v) => {
    expect(quoteHash(v.quote)).toBe(v.quote_hash);
    expect(fingerprint(v.firm, v.issue_class, v.quote_hash)).toBe(v.fingerprint);
  });
  it.each(vectors.length)('length boundary: $name', (v) => {
    const q = 'a'.repeat(v.length);
    if (v.accepted) expect(quoteHash(q)).toMatch(/^[0-9a-f]{64}$/);
    else expect(() => quoteHash(q)).toThrow();
  });
  it.each(vectors.mask)('mask: $name', (v) => expect(mask(v.input, v.spans)).toBe(v.expected));
  it.each(vectors.cp1252)('cp1252: $name', (v) => {
    const text = htmlToLines(v.html).lines[0]!.text;
    expect(text).toBe(v.expected_text);
    expect(quoteHash(text)).toBe(v.quote_hash);
  });
});
