import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fingerprint, fingerprintFor, quoteHash } from '../../src/memory/fingerprint';
import { normalize } from '../../src/memory/normalize';

const word = fc.stringMatching(/^[A-Za-z0-9(),.;$%-]{1,12}$/);
const words = fc.array(word, { minLength: 1, maxLength: 12 });
const ws = fc.constantFrom(' ', '  ', '\t', '\n', '\u00a0', ' \u00a0 ', '\u2003');

describe('fingerprint-normalization-property (AC46)', () => {
  it('should treat Section 4 and Section 5 as different fingerprints', () => {
    const a = fingerprint(
      'firm-x',
      'broken_cross_reference',
      quoteHash('as specified in Part B of Section 4'),
    );
    const b = fingerprint(
      'firm-x',
      'broken_cross_reference',
      quoteHash('as specified in Part B of Section 5'),
    );
    expect(a).not.toBe(b);
  });

  it('case and whitespace variants match', () => {
    fc.assert(
      fc.property(
        words,
        fc.array(ws, { minLength: 12, maxLength: 12 }),
        fc.boolean(),
        (w, seps, upper) => {
          const canonical = w.join(' ');
          const variant = w
            .map((x, i) => (upper ? x.toUpperCase() : x.toLowerCase()) + seps[i]!)
            .join('');
          expect(quoteHash(variant)).toBe(quoteHash(canonical));
        },
      ),
    );
  });

  it('curly-quote variants match straight quotes', () => {
    fc.assert(
      fc.property(words, (w) => {
        const s = w.join(' ');
        expect(quoteHash(`“${s}” ‘x’`)).toBe(quoteHash(`"${s}" 'x'`));
      }),
    );
  });

  it('invisible characters are ignored', () => {
    fc.assert(
      fc.property(
        words,
        fc.constantFrom('\u00ad', '\u200b', '\u200c', '\u200d', '\ufeff'),
        (w, inv) => {
          const s = w.join(' ');
          expect(quoteHash(s.slice(0, 1) + inv + s.slice(1))).toBe(quoteHash(s));
        },
      ),
    );
  });

  it('an edited passage is new: changing any visible character changes the hash', () => {
    fc.assert(
      fc.property(words, fc.nat(), fc.constantFrom('7', 'q', '§', ';'), (w, pos, ch) => {
        const s = w.join(' ');
        const i = pos % s.length;
        const edited = s.slice(0, i) + ch + s.slice(i);
        fc.pre(normalize(edited) !== normalize(s));
        expect(quoteHash(edited)).not.toBe(quoteHash(s));
      }),
    );
  });

  it('normalize is idempotent and keeps digits/punctuation', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (s) => {
        expect(normalize(normalize(s))).toBe(normalize(s));
      }),
    );
    expect(normalize('Section 3(c)(1); 4975 — §')).toBe('section 3(c)(1); 4975 — §');
  });

  it('firm and class are part of the fingerprint; firmId=null means memory not applied', () => {
    const qh = quoteHash('the offered Units');
    expect(fingerprint('firm-x', 'defined_term_issue', qh)).not.toBe(
      fingerprint('firm-y', 'defined_term_issue', qh),
    );
    expect(fingerprint('firm-x', 'defined_term_issue', qh)).not.toBe(
      fingerprint('firm-x', 'ambiguity', qh),
    );
    expect(fingerprintFor({ issue_class: 'defined_term_issue', quote_hash: qh }, null)).toBeNull();
    expect(fingerprintFor({ issue_class: 'defined_term_issue', quote_hash: qh }, 'firm-x')).toBe(
      fingerprint('firm-x', 'defined_term_issue', qh),
    );
  });
});
