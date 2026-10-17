import type { Block } from '../model/types';
import type { DocLocation } from './types';

/** Stored quotes are verbatim substrings of their block text, at most 240 chars (AC-I13). */
export const QUOTE_MAX = 240;

export function blockTextOf(b: Pick<Block, 'lines'>): string {
  return b.lines.map((l) => l.text).join(' ');
}

/** Sentence window around [start, end), clipped to QUOTE_MAX and trimmed (linear, bounded). */
export function sentenceWindow(
  text: string,
  start: number,
  end: number,
): { quote: string; start: number; end: number } {
  const lo = Math.max(0, start - QUOTE_MAX);
  let s = lo;
  for (let i = start - 1; i >= lo; i--) {
    const ch = text[i];
    if ((ch === '.' || ch === ';') && /\s/.test(text[i + 1] ?? ' ')) {
      s = i + 1;
      break;
    }
  }
  const hi = Math.min(text.length, end + QUOTE_MAX);
  let e = hi;
  for (let i = end; i < hi; i++) {
    if (text[i] === '.' && !/[0-9A-Za-z]/.test(text[i + 1] ?? ' ')) {
      e = i + 1;
      break;
    }
  }
  if (e - s > QUOTE_MAX) {
    const span = Math.min(end - start, QUOTE_MAX);
    s = Math.max(s, start - Math.floor((QUOTE_MAX - span) / 2));
    e = Math.min(e, s + QUOTE_MAX);
  }
  while (s < e && /\s/.test(text[s]!)) s++;
  while (e > s && /\s/.test(text[e - 1]!)) e--;
  return { quote: text.slice(s, e), start: s, end: e };
}

export function isVerbatim(blockText: string, quote: string): boolean {
  return quote.length > 0 && quote.length <= QUOTE_MAX && blockText.includes(quote);
}

export function locationOf(
  b: Pick<Block, 'lines' | 'section_path'>,
  blockIndex: number,
  start: number,
  end: number,
): DocLocation {
  const loc: DocLocation = { blockIndex, start, end, sectionPath: [...b.section_path] };
  const page = b.lines[0]?.page;
  if (page !== undefined) loc.page = page;
  return loc;
}
