/**
 * Fingerprint normalization (DATA-MODEL 2.2), frozen as fp1:
 * 1. NFC  2. strip U+00AD, U+200B..U+200D, U+FEFF  3. lowercase (locale-independent)
 * 4. curly quotes -> straight  5. collapse Unicode whitespace (incl. NBSP) to one space, trim.
 * Digits, section numbers, punctuation, dashes and footnote markers are kept.
 */
export function normalize(q: string): string {
  return q
    .normalize('NFC')
    .replace(/[\u00ad\u200b-\u200d\ufeff]/g, '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}
