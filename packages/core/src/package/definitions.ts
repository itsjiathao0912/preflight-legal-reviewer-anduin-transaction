import type { Block } from '../model/types';
import { extractDefinedTerms } from '../structure/defined-terms';
import { blockTextOf, isVerbatim, locationOf, sentenceWindow } from './quote';
import type { CrossDocDefinition } from './types';

/** Unquoted `X means` at block start (term at most 6 words; bounded, linear). */
export const UNQUOTED_MEANS_RE =
  /^\s{0,4}((?:[A-Z][A-Za-z'’&-]{0,30}\s){0,5}[A-Z][A-Za-z'’&-]{0,30})\s{1,3}(?:means|shall mean)\b/;

/**
 * Definitions of a (reference) document: quoted paren/means forms from the structurer plus an
 * unquoted `X means` head. One entry per term (first in document order), each with a verbatim
 * sentence quote and a location.
 */
export function extractPackageDefinitions(
  docId: string,
  blocks: readonly Block[],
): CrossDocDefinition[] {
  const hits: Array<{ term: string; bi: number; start: number; end: number }> = [];
  for (const d of extractDefinedTerms(blocks as Block[]))
    hits.push({ term: d.term, bi: d.blockIndex, start: d.start, end: d.end });
  blocks.forEach((b, bi) => {
    const m = UNQUOTED_MEANS_RE.exec(blockTextOf(b).slice(0, 400));
    if (m) hits.push({ term: m[1]!.trim(), bi, start: m.index, end: m.index + m[0].length });
  });
  hits.sort((a, b) => a.bi - b.bi || a.start - b.start || (a.term < b.term ? -1 : 1));
  const seen = new Set<string>();
  const out: CrossDocDefinition[] = [];
  for (const h of hits) {
    const key = h.term.toLowerCase();
    if (seen.has(key)) continue;
    const b = blocks[h.bi]!;
    const text = blockTextOf(b);
    const w = sentenceWindow(text, h.start, h.end);
    if (!isVerbatim(text, w.quote)) continue;
    seen.add(key);
    out.push({
      docId,
      term: h.term,
      quote: w.quote,
      location: locationOf(b, h.bi, w.start, w.end),
    });
  }
  return out;
}
