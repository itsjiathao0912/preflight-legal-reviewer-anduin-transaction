import type { OcrResult } from '../contracts/ocr';
import type { Line, Region } from '../model/types';
import { isLowConfidence, pageConfidence } from '../ocr/confidence';
import { stripPageNoise, type DroppedLine } from './page-noise';
import { setSupSegments, type SupSegment } from './sup-segments';

/**
 * OCR adapter (Phase 06 D1/D2/D7): frozen `OcrResult` pages -> Line stream.
 *
 *  - one Line per OCR line (one visual row), so `structure/option-groups.ts` sees a single-line
 *    block per grid row (the sup seam reads `block.lines[0]` only when the block has one line)
 *  - `^{n}` footnote markers (the model adds a space before them) are stripped from the text and
 *    recorded as zero-width sup segments at the end of the cleaned label, via `setSupSegments`
 *  - ☐ / ☒ checkbox glyphs are kept as-is (the HTML adapter emits the same glyphs)
 *  - `page` = OCR page index + 1 (1-based); `region` = the line bbox, normalized 0..1 of the
 *    downscaled page image (top-left origin, the same convention as the PDF text adapter)
 *  - page noise (page numbers such as the "1/8" scan footer, running headers) is dropped via the
 *    shared `stripPageNoise`; dropped lines are kept per page for the viewer
 *
 * OCR text is untrusted DATA: it is only ever turned into Line text, never interpreted.
 */

/** `^{n}` marker with up to 8 spaces/tabs before it (bounded; ReDoS suite). */
export const OCR_MARKER_RE = /[ \t]{0,8}\^\{(\d{1,3})\}/g;
/** Hard cap on lines taken from one OCR page (hostile or looping model output). */
export const OCR_MAX_LINES_PER_PAGE = 400;
/** Hard cap on characters per line (mirrors OcrResultSchema text max). */
export const OCR_MAX_LINE_CHARS = 4000;

export type OcrPage = OcrResult['pages'][number];

export interface OcrPageLines {
  /** 0-based page index (as in the OCR result). */
  index: number;
  lines: Line[];
  dropped: DroppedLine[];
  /** Page confidence = min(self-reported ?? 0.7, structural score). */
  conf: number;
  lowConfidence: boolean;
  /** True when the model output had more than OCR_MAX_LINES_PER_PAGE lines. */
  truncated: boolean;
}

export interface OcrLinesResult {
  lines: Line[];
  pages: OcrPageLines[];
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Clamp a bbox into the unit square (hostile or sloppy model output). */
export function normalizeRegion(b: Region): Region {
  const x = clamp01(b.x);
  const y = clamp01(b.y);
  return { x, y, w: Math.min(clamp01(b.w), 1 - x), h: Math.min(clamp01(b.h), 1 - y) };
}

/** Strip `^{n}` markers; return the cleaned text and zero-width sup segments on it. */
export function stripMarkers(raw: string): { text: string; sups: SupSegment[] } {
  let text = '';
  let last = 0;
  const sups: SupSegment[] = [];
  for (const m of raw.matchAll(OCR_MARKER_RE)) {
    text += raw.slice(last, m.index);
    sups.push({ start: text.length, end: text.length, text: m[1]! });
    last = m.index + m[0].length;
  }
  text += raw.slice(last);
  return { text, sups };
}

function pageLines(p: OcrPage): { lines: Line[]; truncated: boolean } {
  const lines: Line[] = [];
  const src = p.lines.slice(0, OCR_MAX_LINES_PER_PAGE);
  for (const l of src) {
    const { text, sups } = stripMarkers(l.text.slice(0, OCR_MAX_LINE_CHARS));
    if (text.trim().length === 0) continue;
    const line: Line = {
      text,
      cue: { bold: false, caps: false, indent: 0, position: 'unknown', cue_source: 'ocr' },
      page: p.index + 1,
    };
    if (l.bbox) line.region = normalizeRegion(l.bbox);
    setSupSegments(line, sups);
    lines.push(line);
  }
  return { lines, truncated: p.lines.length > OCR_MAX_LINES_PER_PAGE };
}

/** OCR result(s) -> Lines (document order = page index order, then line order). */
export function ocrToLines(input: OcrResult | readonly OcrPage[]): OcrLinesResult {
  const pagesIn = [...('pages' in input ? input.pages : input)].sort((a, b) => a.index - b.index);
  const raw = pagesIn.map(pageLines);
  const noise = stripPageNoise(raw.map((r) => r.lines));
  const pages: OcrPageLines[] = pagesIn.map((p, i) => {
    const conf = pageConfidence(p.lines);
    return {
      index: p.index,
      lines: noise.pages[i]!,
      dropped: noise.dropped[i]!,
      conf,
      lowConfidence: isLowConfidence(conf),
      truncated: raw[i]!.truncated,
    };
  });
  return { lines: pages.flatMap((p) => p.lines), pages };
}
