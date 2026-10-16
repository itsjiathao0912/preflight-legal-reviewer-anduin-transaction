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

/** Digit runs of 6+ digits (optionally separated by - or space) — candidate account/routing numbers. */
export const ACCOUNT_NUMBER_RE = /\b\d(?:[ -]?\d){5,30}\b/g;

export function sensitiveSpans(text: string): Span[] {
  const out: Span[] = [];
  for (const m of text.matchAll(ACCOUNT_NUMBER_RE))
    out.push({ start: m.index!, end: m.index! + m[0].length });
  return out;
}
