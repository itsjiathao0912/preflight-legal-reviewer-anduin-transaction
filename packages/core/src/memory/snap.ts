import { limits } from '../config/limits';

/**
 * snapToSentence: expand [matchStart, matchEnd) to the enclosing sentence of blockText.
 * Boundary = . ? ! ; followed by whitespace + (uppercase | digit | quote), or block start/end.
 * Closed abbreviation list and decimals are not boundaries. If the sentence is longer than
 * limits.quoteMaxChars it is cut to a window of that size centred on the match, at word boundaries.
 */
export const ABBREVIATIONS = [
  'Inc.',
  'Ltd.',
  'U.S.',
  'No.',
  'Sec.',
  'e.g.',
  'i.e.',
  'Corp.',
  'Co.',
] as const;

function isBoundary(text: string, i: number): boolean {
  // i = index of the terminator character
  const ch = text[i];
  if (ch !== '.' && ch !== '?' && ch !== '!' && ch !== ';') return false;
  if (ch === '.') {
    // decimal: digit.digit
    if (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) return false;
    // list marker "6." at block start or right after a terminator is not a sentence end
    const head = text.slice(Math.max(0, i - 8), i);
    if (
      (i <= 4 && /^\s*\(?\d{1,2}$/.test(text.slice(0, i))) ||
      /[.;:]\s{1,4}\(?\d{1,2}$/.test(head)
    )
      return false;
    for (const abbr of ABBREVIATIONS) {
      const start = i - abbr.length + 1;
      if (
        start >= 0 &&
        text.slice(start, i + 1) === abbr &&
        (start === 0 || /[\s(]/.test(text[start - 1]!))
      )
        return false;
    }
  }
  let j = i + 1;
  if (j >= text.length) return true;
  if (!/\s/.test(text[j]!)) return false;
  while (j < text.length && /\s/.test(text[j]!)) j++;
  if (j >= text.length) return true;
  return /[A-Z0-9"'“‘(•☐☒]/.test(text[j]!);
}

export function snapToSentence(
  blockText: string,
  matchStart: number,
  matchEnd: number,
): { quote: string; start: number; end: number } {
  const ms = Math.max(0, Math.min(matchStart, blockText.length));
  const me = Math.max(ms, Math.min(matchEnd, blockText.length));
  let start = 0;
  for (let i = ms - 1; i >= 0; i--) {
    if (isBoundary(blockText, i)) {
      start = i + 1;
      break;
    }
  }
  let end = blockText.length;
  for (let i = Math.max(me - 1, ms); i < blockText.length; i++) {
    if (i >= me - 1 && isBoundary(blockText, i) && i + 1 > ms) {
      end = i + 1;
      break;
    }
  }
  while (start < end && /\s/.test(blockText[start]!)) start++;
  while (end > start && /\s/.test(blockText[end - 1]!)) end--;
  const max = limits.quoteMaxChars;
  if (end - start > max) {
    const centre = Math.floor((ms + me) / 2);
    let ws = Math.max(start, centre - Math.floor(max / 2));
    let we = Math.min(end, ws + max);
    ws = Math.max(start, we - max);
    // word boundaries: move inwards to whitespace
    if (ws > start && !/\s/.test(blockText[ws - 1]!)) {
      const sp = blockText.indexOf(' ', ws);
      if (sp !== -1 && sp < ms) ws = sp + 1;
    }
    if (we < end && !/\s/.test(blockText[we]!)) {
      const sp = blockText.lastIndexOf(' ', we);
      if (sp > me) we = sp;
    }
    start = ws;
    end = we;
    while (end > start && /\s/.test(blockText[end - 1]!)) end--;
  }
  return { quote: blockText.slice(start, end), start, end };
}
