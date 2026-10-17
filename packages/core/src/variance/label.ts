import { normText, scopeLabel } from '../diff/normalize-key';

/** Assertion labels are capped (D1 `regression_check.assertion_key` <= 80 chars). */
export const ASSERTION_LABEL_MAX = 80;

const KIND_RE = /\b(appendix|exhibit|schedule|annex|part)\s+(?:[a-z]{1,4}|\d{1,3})\b/i;

/**
 * Normalize a scope label for `scope_exists` checks: "Appendix C", "appendix c", "APPENDIX  C" and
 * "SUBSCRIPTION AGREEMENT – APPENDIX C" all give "appendix c" (kind word + `scopeLabel`). Labels
 * without an appendix/exhibit/schedule/annex/part word fall back to `normText`. Pure; at most 80
 * chars. The Phase 03 server re-normalization imports this same function.
 */
export function normalizeAssertionLabel(label: string): string {
  const text = String(label ?? '').slice(0, 400);
  const kind = KIND_RE.exec(text);
  const tail = scopeLabel(text);
  if (kind && tail) return `${kind[1]!.toLowerCase()} ${tail}`.slice(0, ASSERTION_LABEL_MAX);
  return normText(text).slice(0, ASSERTION_LABEL_MAX);
}

/** Display form of a normalized label: "appendix c" -> "Appendix C". */
export function displayAssertionLabel(normalized: string): string {
  const words = normalized.split(' ').filter(Boolean);
  const scoped = words.length === 2 && KIND_RE.test(normalized);
  return words
    .map((w, i) => (scoped && i === 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
