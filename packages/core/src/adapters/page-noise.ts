import type { Line } from '../model/types';

/**
 * Page noise filter shared by the PDF and OCR adapters (Phase 06 D7). HTML noise is handled by
 * the HTML adapter's own NOISE_RULES and is not touched here.
 *
 * Dropped:
 *  - page-number lines in the top/bottom band: "Page 2 of 9", "2 of 9", "1/8" (scan footer),
 *    "- 3 -", "3"
 *  - running headers/footers: digit-normalized text that sits in the top/bottom band on at
 *    least 3 pages AND on at least half of the pages
 * Nothing is lost: every dropped line is kept in the per-page `dropped` list (viewer raw text).
 * All regexes are anchored with bounded quantifiers (ReDoS suite: test/security/redos.test.ts).
 */

/** "Page 2 of 9", "2 of 9", "1/8", "1 / 8". */
export const PAGE_N_OF_M_RE =
  /^\s{0,20}(?:page\s{1,5})?\d{1,4}\s{0,5}(?:\/|of)\s{0,5}\d{1,4}\s{0,20}$/i;
/** "3", "- 3 -", "-3", "Page 3". */
export const PAGE_BARE_RE = /^\s{0,20}(?:page\s{1,5})?-?\s{0,5}\d{1,4}\s{0,5}-?\s{0,20}$/i;
/** Digit runs collapse to '#' so "Page 2" and "Page 3" headers compare equal. */
export const DIGIT_RUN_RE = /\d{1,12}/g;
/** Whitespace runs collapse to one space for header comparison. */
export const WS_RUN_RE = /\s{1,4000}/g;

/** A line is in the band when its region starts above TOP_BAND or ends below BOTTOM_BAND. */
export const TOP_BAND = 0.1;
export const BOTTOM_BAND = 0.9;
/** Without regions, the first and last N lines of a page form the band. */
export const BAND_LINES = 2;
export const REPEAT_MIN_PAGES = 3;
export const REPEAT_MIN_SHARE = 0.5;
/** Header comparison only considers this many leading characters. */
const KEY_MAX = 200;

export type NoiseRule = 'page-number' | 'repeated-header-footer';

export interface DroppedLine<T extends Line = Line> {
  line: T;
  rule: NoiseRule;
}

export interface PageNoiseResult<T extends Line = Line> {
  /** Kept lines per page (same order as the input). */
  pages: T[][];
  /** Dropped lines per page, in input order (raw list for the viewer). */
  dropped: DroppedLine<T>[][];
}

export function isPageNumberLine(text: string): boolean {
  if (text.length > 64) return false;
  return PAGE_N_OF_M_RE.test(text) || PAGE_BARE_RE.test(text);
}

/** Digit-normalized, case- and space-folded comparison key for running headers/footers. */
export function headerKey(text: string): string {
  return text
    .slice(0, KEY_MAX)
    .replace(DIGIT_RUN_RE, '#')
    .replace(WS_RUN_RE, ' ')
    .trim()
    .toLowerCase();
}

function inBand(line: Line, i: number, n: number): boolean {
  const r = line.region;
  if (r) return r.y < TOP_BAND || r.y + r.h > BOTTOM_BAND;
  return i < BAND_LINES || i >= n - BAND_LINES;
}

/**
 * Remove page numbers and repeated running headers/footers. `pages[i]` is the line list of
 * page i; a page may be empty (e.g. a scan page awaiting OCR) and still counts toward the page
 * total for the 50% rule.
 */
export function stripPageNoise<T extends Line>(
  pages: readonly (readonly T[])[],
): PageNoiseResult<T> {
  // Count, per key, the number of distinct pages where it appears inside the band.
  const pagesWithKey = new Map<string, number>();
  pages.forEach((lines) => {
    const seen = new Set<string>();
    lines.forEach((line, i) => {
      if (!inBand(line, i, lines.length)) return;
      const k = headerKey(line.text);
      if (k && !seen.has(k)) {
        seen.add(k);
        pagesWithKey.set(k, (pagesWithKey.get(k) ?? 0) + 1);
      }
    });
  });
  const minPages = Math.max(REPEAT_MIN_PAGES, Math.ceil(pages.length * REPEAT_MIN_SHARE));
  const repeated = new Set(
    [...pagesWithKey].filter(([, count]) => count >= minPages).map(([k]) => k),
  );

  const kept: T[][] = [];
  const dropped: DroppedLine<T>[][] = [];
  for (const lines of pages) {
    const keep: T[] = [];
    const drop: DroppedLine<T>[] = [];
    lines.forEach((line, i) => {
      if (inBand(line, i, lines.length)) {
        if (isPageNumberLine(line.text)) return void drop.push({ line, rule: 'page-number' });
        if (repeated.has(headerKey(line.text)))
          return void drop.push({ line, rule: 'repeated-header-footer' });
      }
      keep.push(line);
    });
    kept.push(keep);
    dropped.push(drop);
  }
  return { pages: kept, dropped };
}
