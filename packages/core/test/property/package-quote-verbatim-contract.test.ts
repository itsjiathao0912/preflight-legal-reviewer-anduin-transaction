import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Block } from '../../src/model/types';
import { extractExternalReferences } from '../../src/package/index';

const block = (text: string): Block =>
  ({
    id: 'b0',
    kind: 'paragraph',
    lines: [{ text, cue: { bold: false, caps: false, indent: 0, position: 'unknown' } }],
    section_path: ['1. Terms'],
    scopeId: 's',
    anchor: { docHash: 'h', blockId: 'b0', offsetStart: 0, offsetEnd: text.length },
  }) as Block;

const PHRASES = [
  'as defined in the Partnership Agreement',
  'see Annex F',
  'deliver a Form W-8BEN-E',
  'under the Side Letter',
  'described in the Private Placement Memorandum',
  'pursuant to the LLC Agreement',
];
const filler = fc.stringMatching(/^[a-z ,.;]{0,300}$/);
const text = fc
  .array(fc.tuple(filler, fc.constantFrom(...PHRASES)), { minLength: 1, maxLength: 6 })
  .chain((parts) =>
    filler.map((tail) => parts.map(([f, p]) => `${f} ${p}`).join(' ') + ' ' + tail),
  );

describe('package-quote-verbatim-contract (AC-I13)', () => {
  it('every returned quote is a verbatim substring of its block, at most 240 chars', () => {
    fc.assert(
      fc.property(text, (t) => {
        const { references, dropped } = extractExternalReferences([block(t)], {
          docId: 'a'.repeat(64),
          scopeLabels: [],
        });
        expect(dropped).toBe(0);
        expect(references.length).toBeGreaterThan(0);
        for (const r of references) {
          expect(t).toContain(r.quote);
          expect(r.quote.length).toBeLessThanOrEqual(240);
          expect(r.quote.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 300, seed: 20261017 },
    );
  });

  it('an injected corrupt quote is dropped and counted', () => {
    fc.assert(
      fc.property(text, (t) => {
        const clean = extractExternalReferences([block(t)], {
          docId: 'a'.repeat(64),
          scopeLabels: [],
        });
        const bad = extractExternalReferences([block(t)], {
          docId: 'a'.repeat(64),
          scopeLabels: [],
          quoteOf: (s, a, b) => ({ quote: s.slice(a, b) + '\u0000corrupt', start: a, end: b }),
        });
        expect(bad.references).toHaveLength(0);
        expect(bad.dropped).toBe(clean.references.length);
      }),
      { numRuns: 100, seed: 7 },
    );
  });
});
