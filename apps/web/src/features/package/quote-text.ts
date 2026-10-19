import { QUOTE_MAX, maskQuote } from '@aduin/core';

const QUOTE_MARKS = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g;

/** Length from which a stored quote may have been cut by core's QUOTE_MAX window clamp. */
const CLAMPED = QUOTE_MAX - 8;

/**
 * Display text of a stored package quote inside <q> (which adds its own quote marks).
 * - Outer quote marks are stripped so they do not double up.
 * - A clamped quote (stored length near QUOTE_MAX) that starts mid-sentence (first character a
 *   lowercase letter) drops its leading partial word and starts with "…".
 * - A quote stored at QUOTE_MAX that does not end a sentence ends at a word boundary with "…".
 * Shorter quotes render unchanged (apart from quote marks and masking).
 */
export function quoteText(quote: string): string {
  let s = maskQuote(quote.replace(QUOTE_MARKS, ''));
  if (quote.length < CLAMPED) return s;
  let lead = '';
  if (/^\p{Ll}/u.test(s)) {
    const sp = s.indexOf(' ');
    if (sp > 0 && sp < s.length / 2) s = s.slice(sp + 1).replace(/^[\s,;:)–—-]+/, '');
    lead = '…';
  }
  if (quote.length < QUOTE_MAX) return lead + s;
  if (s.endsWith('…')) s = s.slice(0, -1);
  if (/[.;:!?)]$/.test(s)) return lead + s;
  const cut = s.lastIndexOf(' ');
  if (cut > s.length / 2) s = s.slice(0, cut);
  return `${lead}${s.replace(/[\s,;:(–—-]+$/, '')}…`;
}
