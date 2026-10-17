import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { RULES_CAPS, injectedRulesHash, selectInjectedRules } from '../../src/llm/rules';
import { rulesHash } from '../../src/memory/rulesHash';
import { locateQuote, normalizeForLocate } from '../../src/llm/verify-quote';
import { analyzeHtml } from '../../src/engine';

const ruleText = fc.string({ minLength: 0, maxLength: 60, unit: 'grapheme' });

describe('S0.3 property: rules normalization, caps and hash', () => {
  it('selection and hash are order independent', () => {
    const arb = fc
      .array(ruleText, { maxLength: 30 })
      .chain((t) =>
        fc.tuple(
          fc.constant(t),
          fc.shuffledSubarray(t, { minLength: t.length, maxLength: t.length }),
        ),
      );
    fc.assert(
      fc.property(arb, ([texts, shuffled]) => {
        const a = selectInjectedRules(texts);
        const b = selectInjectedRules(shuffled);
        expect(b.hash).toBe(a.hash);
        expect(b.texts).toEqual(a.texts);
        expect(b.applied).toBe(a.applied);
      }),
      { numRuns: 200 },
    );
  });

  it('injectedRulesHash equals core rulesHash whenever no cap applies', () => {
    fc.assert(
      fc.property(fc.array(ruleText, { maxLength: RULES_CAPS.maxRules }), (texts) => {
        const sel = selectInjectedRules(texts);
        if (!sel.truncated) expect(injectedRulesHash(texts)).toBe(rulesHash(texts));
      }),
      { numRuns: 300 },
    );
  });

  it('caps always hold, counts are consistent and truncation is deterministic', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 700 }), { maxLength: 40 }), (texts) => {
        const sel = selectInjectedRules(texts);
        expect(sel.applied).toBe(sel.texts.length);
        expect(sel.applied).toBeLessThanOrEqual(RULES_CAPS.maxRules);
        expect(sel.applied).toBeLessThanOrEqual(sel.total);
        expect(sel.truncated).toBe(sel.applied < sel.total);
        const bytes = sel.texts.reduce((n, t) => n + new TextEncoder().encode(t).length, 0);
        expect(bytes).toBeLessThanOrEqual(RULES_CAPS.maxTotalBytes);
        for (const t of sel.texts)
          expect([...t].length).toBeLessThanOrEqual(RULES_CAPS.maxRuleCodePoints);
        expect(selectInjectedRules(texts)).toEqual(sel);
        expect(sel.hash8).toBe(sel.hash === 'none' ? 'none' : sel.hash.slice(0, 8));
      }),
      { numRuns: 200 },
    );
  });
});

describe('S0.3 property: verify-quote tolerance', () => {
  const words = fc.array(fc.stringMatching(/^[A-Za-z]{2,9}$/), { minLength: 6, maxLength: 20 });

  it('a substring of a block is found after case / whitespace / quote-style changes', () => {
    fc.assert(
      fc.property(words, fc.nat(), fc.nat(), (ws, a, b) => {
        const sentence = ws.join(' ');
        const g = analyzeHtml(`<html><body><p>${sentence}.</p></body></html>`);
        const i = a % (ws.length - 2);
        const j = i + 1 + (b % (ws.length - i - 1));
        const piece = ws.slice(i, j + 1);
        const variant = piece
          .map((w, k) => (k % 2 ? w.toUpperCase() : w.toLowerCase()))
          .join(k2(b));
        const loc = locateQuote(g, `“${variant}”`);
        expect(loc).not.toBeNull();
        const block = g.structure.blocks[loc!.blockIndex]!.lines.map((l) => l.text).join(' ');
        expect(normalizeForLocate(block.slice(loc!.start, loc!.end)).text).toBe(
          normalizeForLocate(piece.join(' ')).text,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('a quote with a word that is not in the document is never located', () => {
    fc.assert(
      fc.property(words, (ws) => {
        const g = analyzeHtml(`<html><body><p>${ws.join(' ')}.</p></body></html>`);
        expect(locateQuote(g, `${ws[0]} zzqqxxunseen ${ws[1]}`)).toBeNull();
      }),
      { numRuns: 50 },
    );
  });
});

function k2(n: number): string {
  return ['  ', ' \t ', '\u00a0', ' '][n % 4]!;
}
