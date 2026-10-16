import type { Block } from '../model/types';
import type { DefinedTerm } from './types';

/**
 * Defined terms: `(the "X")`, `("X")`, `"X" means` (ideas ported from
 * defined-terms-checker, MIT; own implementation and tests). Quotes may be
 * straight or curly. Linear-time, bounded term length.
 */
export const PAREN_DEF_RE =
  /\(\s*(?:collectively,?\s+|each,?\s+|individually,?\s+)?(?:the\s+|a\s+|an\s+)?["“]([A-Z][A-Za-z0-9.&'’ -]{0,60}?)["”]\s*\)/g;
export const MEANS_DEF_RE =
  /["“]([A-Z][A-Za-z0-9.&'’ -]{0,60}?)["”]\s+(?:means|shall mean|has the meaning|shall have the meaning)\b/g;

export function extractDefinedTerms(blocks: Block[]): DefinedTerm[] {
  const out: DefinedTerm[] = [];
  blocks.forEach((b, bi) => {
    const text = b.lines.map((l) => l.text).join(' ');
    for (const m of text.matchAll(PAREN_DEF_RE)) {
      out.push({
        term: m[1]!.trim(),
        blockIndex: bi,
        start: m.index!,
        end: m.index! + m[0].length,
        form: 'paren',
      });
    }
    for (const m of text.matchAll(MEANS_DEF_RE)) {
      out.push({
        term: m[1]!.trim(),
        blockIndex: bi,
        start: m.index!,
        end: m.index! + m[0].length,
        form: 'means',
      });
    }
  });
  return out;
}

export function isDefined(terms: DefinedTerm[], term: string): boolean {
  return terms.some((t) => t.term === term);
}
