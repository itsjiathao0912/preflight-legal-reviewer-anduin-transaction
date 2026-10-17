import { limits } from '../config/limits';

/**
 * Per-page OCR confidence (Phase 06 Public Contracts):
 *   page_confidence = min(model_self_reported ?? 0.7, structural_score)
 * The free vision model reports ~0.95 on every line (06a probe), so the structural score is the
 * informative half. Structural score = product of bounded penalties for: no non-empty lines,
 * repeated-token loops, low alphabetic ratio, and many empty lines. A page below
 * `limits.ocrLowConfidence` (0.6) is low-confidence and visibly marked.
 */

/** Default when the model reports no confidence of its own. */
export const DEFAULT_SELF_REPORTED = 0.7;
/** Tokens considered for loop detection (bounded work per page). */
const MAX_TOKENS = 5000;
/** Letters (any script) count as alphabetic. */
const LETTER_RE = /\p{L}/u;
const SPACE_RE = /\s/u;
/** Whitespace token splitter (bounded run length). */
const TOKEN_SPLIT_RE = /\s{1,4000}/u;

export interface ConfidenceLine {
  text: string;
  conf?: number;
}

/** Mean of the per-line self-reported confidences, or undefined when none is present. */
export function selfReported(lines: readonly ConfidenceLine[]): number | undefined {
  let sum = 0;
  let n = 0;
  for (const l of lines) {
    if (typeof l.conf === 'number' && Number.isFinite(l.conf)) {
      sum += Math.min(1, Math.max(0, l.conf));
      n++;
    }
  }
  return n ? sum / n : undefined;
}

/** Longest run of one token repeated back to back (a degenerate decoding loop). */
export function longestRepeatRun(tokens: readonly string[]): number {
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const t of tokens) {
    if (t === prev) run++;
    else {
      run = 1;
      prev = t;
    }
    if (run > best) best = run;
  }
  return best;
}

/** Structural score in [0, 1] from the extracted lines alone. */
export function structuralScore(lines: readonly ConfidenceLine[]): number {
  const nonEmpty = lines.filter((l) => l.text.trim().length > 0);
  if (nonEmpty.length === 0) return 0;
  let score = 1;

  // Alphabetic ratio over non-space characters (scans of forms are mostly words).
  let letters = 0;
  let chars = 0;
  for (const l of nonEmpty) {
    for (const ch of l.text) {
      if (SPACE_RE.test(ch)) continue;
      chars++;
      if (LETTER_RE.test(ch)) letters++;
    }
  }
  const alpha = chars ? letters / chars : 0;
  if (alpha < 0.5) score *= Math.max(0.2, alpha / 0.5);

  // Repeated-token loops ("the the the the ...") or the same line many times over.
  const tokens: string[] = [];
  for (const l of nonEmpty) {
    for (const t of l.text.split(TOKEN_SPLIT_RE)) {
      if (t) tokens.push(t.toLowerCase());
      if (tokens.length >= MAX_TOKENS) break;
    }
    if (tokens.length >= MAX_TOKENS) break;
  }
  const run = longestRepeatRun(tokens);
  if (run >= 8) score *= 0.3;
  else if (run >= 5) score *= 0.7;
  const distinctLines = new Set(nonEmpty.map((l) => l.text.trim())).size;
  if (nonEmpty.length >= 6 && distinctLines / nonEmpty.length < 0.5) score *= 0.5;

  // Many empty lines is a weak signal of a broken read.
  const emptyShare = 1 - nonEmpty.length / lines.length;
  if (emptyShare > 0.5) score *= 0.7;

  return Math.max(0, Math.min(1, score));
}

/** Page confidence = min(self-reported ?? 0.7, structural score). */
export function pageConfidence(lines: readonly ConfidenceLine[]): number {
  const self = selfReported(lines) ?? DEFAULT_SELF_REPORTED;
  return Math.min(self, structuralScore(lines));
}

/** True when a page confidence is below the low-confidence threshold (limits.ocrLowConfidence). */
export function isLowConfidence(conf: number): boolean {
  return conf < limits.ocrLowConfidence;
}
