/**
 * Sensitive-span masking (DATA-MODEL 2.2): each flagged span is replaced by
 * "#" + its last 4 digits (no length leak: "021000021" -> "#0021").
 * Applied before normalization, for both quote_hash and quote_snippet.
 */
export interface Span {
  start: number;
  end: number;
}

export function maskToken(span: string): string {
  const digits = span.replace(/\D/g, '');
  return '#' + digits.slice(-4);
}

/** Mask the given spans (non-overlapping after merge). Pure. */
export function mask(text: string, spans: Span[]): string {
  if (spans.length === 0) return text;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of sorted) {
    const start = Math.max(0, s.start);
    const end = Math.min(text.length, s.end);
    if (end <= start) continue;
    const last = merged.at(-1);
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else merged.push({ start, end });
  }
  let out = '';
  let pos = 0;
  for (const s of merged) {
    out += text.slice(pos, s.start) + maskToken(text.slice(s.start, s.end));
    pos = s.end;
  }
  return out + text.slice(pos);
}

/**
 * Candidate account/routing numbers (F3-widened twice; every quantifier bounded, no nested
 * unbounded repetition, linear on hostile input — covered by security/redos.test.ts):
 *  1. IBAN-like: 2 letters + 2 check digits + 2..7 groups of 4 alphanumerics (+ short tail)
 *  2. alpha-prefixed account: 1-4 letters (any case), optional dash, 6-130 digits ("DDA-12345678",
 *     "acct12345678")
 *  3. digit runs of 6+ digits, optionally separated by space, "-", "–", ".", "/" or NBSP. No
 *     word-boundary assertions: a run glued to letters ("021000021x") is still caught, and a run
 *     longer than the 131-digit bound is matched in adjacent chunks that mask() merges into one span.
 */
export const ACCOUNT_NUMBER_RE =
  /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?\b|\b[A-Za-z]{1,4}-?\d{6,130}|\d(?:[ \-\u2013./\u00A0]?\d){5,130}/g;

export function sensitiveSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(ACCOUNT_NUMBER_RE))
    out.push({ start: m.index!, end: m.index! + m[0].length });
  return out;
}
