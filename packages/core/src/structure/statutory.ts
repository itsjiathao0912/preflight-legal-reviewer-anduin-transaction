/**
 * Statutory / external exclusions (Pinned Algorithm S).
 * All patterns are linear-time (bounded windows, no nested quantifiers).
 */

export const STATUTORY_WINDOW = 40;
export const BARE_REPEAT_WINDOW = 400;

/** Marker after "Section N" within STATUTORY_WINDOW chars. */
export const STATUTE_AFTER_RE =
  /\bof\s+(?:the\s+)?(?:ERISA|Code|Internal Revenue Code|U\.S\. Internal Revenue Code|Securities Act|Exchange Act|Advisers Act|Investment Company Act|Investment Advisers Act|1940 Act|1933 Act|1934 Act|Act of \d{4}|Regulation [A-Z]{1,3}\b)/;
export const OF_THE_ACT_RE = /\bof\s+the\s+[A-Z][A-Za-z.' ]{0,40}\sAct\b/;
export const RULE_RE =
  /\bRule\s+\d{1,4}[a-z0-9-]{0,12}(?:\([a-z0-9]{1,6}\)){0,6}(?:-\d{1,3})?\s+(?:under|of|promulgated)\b/g;
export const USC_RE = /\b\d{1,3}\s+U\.S\.C\.\s*(?:§\s?)?\d{1,6}/g;
export const CFR_RE = /\b\d{1,3}\s+C\.F\.R\./g;
/** Generic statute marker used for the bare-repeat proximity rule. */
export const STATUTE_MARKER_RE =
  /\b(?:ERISA|Internal Revenue Code|the Code|Securities Act|Exchange Act|Advisers Act|Investment Company Act|1940 Act|1933 Act|1934 Act|U\.S\.C\.|C\.F\.R\.)/;

export type StatutoryRule =
  | 'marker-after'
  | 'of-the-act'
  | 'subsection-chain'
  | 'bare-repeat'
  | 'out-of-range'
  | 'decimal-section';

/** Classify a "Section N" match by its surrounding text (rules that need only local text). */
export function localStatutoryRule(after: string, chain: string): StatutoryRule | null {
  const window = after.slice(0, STATUTORY_WINDOW);
  if (STATUTE_AFTER_RE.test(window)) return 'marker-after';
  if (
    OF_THE_ACT_RE.test(after.slice(0, STATUTORY_WINDOW + 50)) &&
    /^\s*(?:\([a-z0-9]{1,6}\)){0,6}\s*,?\s*of\s+the\b/.test(window)
  )
    return 'of-the-act';
  if (chain.length > 0) return 'subsection-chain';
  return null;
}
