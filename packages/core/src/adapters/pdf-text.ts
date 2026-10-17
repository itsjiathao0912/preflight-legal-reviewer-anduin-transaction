import { limits } from '../config/limits';
import { isCaps } from '../model/line-stream';
import type { Cue, Line, Region } from '../model/types';
import { stripPageNoise, type DroppedLine } from './page-noise';
import { setSupSegments, type SupSegment } from './sup-segments';

/**
 * Text-PDF lines (Phase 06 D4): a PURE function from positioned text items to Line[].
 * No pdf.js here; `pdf.ts` feeds it. Coordinates are viewport coordinates (top-left origin,
 * y grows downward, PDF points at scale 1), so page rotation is already applied by the caller.
 *
 *  - y-clustering: items whose baselines are within 40% of the larger font size form one row
 *  - gap columns: inside a row, items are ordered by x; a gap wider than ~0.2 em becomes one
 *    space. Cells of a table row and the options of a checkbox grid stay ONE Line per visual
 *    row (same rule as the HTML adapter's <tr> merge), so option-group detection works alike.
 *  - superscripts: a short digit run set in a smaller font and raised above the row baseline
 *    is recorded as a SupSegment (same side channel as HTML <sup>)
 *  - region per line: normalized 0..1 of the page (x, y top-left, w, h), the same convention as
 *    the OCR bbox
 *  - a page with fewer than MIN_TEXT_CHARS non-space characters is a scan page: no lines, its
 *    0-based index goes to `scanPages` for render + OCR
 *  - page numbers and running headers/footers are dropped via page-noise.ts (kept in `dropped`)
 */

export interface PdfTextItem {
  str: string;
  /** Left edge of the run. */
  x: number;
  /** Baseline, measured from the top of the page. */
  y: number;
  /** Advance width of the run. */
  w: number;
  /** Font size (glyph height) of the run. */
  h: number;
  bold?: boolean;
}

export interface PdfTextPage {
  /** 0-based page index. */
  index: number;
  width: number;
  height: number;
  items: readonly PdfTextItem[];
}

export interface PdfPageLines {
  index: number;
  scan: boolean;
  /** Non-space characters in the page's text layer. */
  textChars: number;
  lines: Line[];
  dropped: DroppedLine[];
}

export interface PdfLinesResult {
  lines: Line[];
  /** 0-based indices of pages without a usable text layer (route to OCR). */
  scanPages: number[];
  pages: PdfPageLines[];
}

/** Pages with fewer non-space characters than this are routed to OCR. */
export const MIN_TEXT_CHARS = 20;
/** Baselines within this fraction of the larger font size share a row. */
const ROW_TOLERANCE = 0.4;
/** Gap (in em of the current run) above which a space is inserted. */
const SPACE_GAP_EM = 0.2;
/** A raised run counts as a superscript when its size is at most this share of the row size. */
const SUP_SIZE_SHARE = 0.8;
/** Superscript marker text. */
export const SUP_MARKER_RE = /^\d{1,2}$/;
/** Any whitespace character (non-space counting). */
export const WHITESPACE_RE = /\s/g;

export function nonSpaceChars(items: readonly PdfTextItem[]): number {
  let n = 0;
  for (const it of items) n += it.str.replace(WHITESPACE_RE, '').length;
  return n;
}

interface Row {
  baseline: number;
  size: number;
  items: PdfTextItem[];
}

function clusterRows(items: readonly PdfTextItem[]): Row[] {
  const sorted = items
    .filter((it) => it.str.trim() !== '' && Number.isFinite(it.x) && Number.isFinite(it.y))
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Row[] = [];
  for (const it of sorted) {
    const size = Math.max(it.h, 1);
    const row = rows[rows.length - 1];
    if (row && Math.abs(it.y - row.baseline) <= ROW_TOLERANCE * Math.max(size, row.size)) {
      row.items.push(it);
      // The baseline and size of a row follow its largest run (superscripts do not move it).
      if (size > row.size) {
        row.size = size;
        row.baseline = it.y;
      }
    } else {
      rows.push({ baseline: it.y, size, items: [it] });
    }
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

interface Built {
  text: string;
  sups: SupSegment[];
  bold: boolean;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

function buildRow(row: Row): Built {
  let text = '';
  const sups: SupSegment[] = [];
  let boldChars = 0;
  let allChars = 0;
  let x0 = Infinity;
  let x1 = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let prev: PdfTextItem | undefined;
  for (const it of row.items) {
    const gap = prev ? it.x - (prev.x + prev.w) : 0;
    const em = Math.max(prev?.h ?? it.h, 1);
    if (prev && gap > SPACE_GAP_EM * em && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
    const s = it.str.replace(WHITESPACE_RE, ' ');
    const isSup =
      prev !== undefined &&
      SUP_MARKER_RE.test(s.trim()) &&
      it.h <= SUP_SIZE_SHARE * row.size &&
      it.y < row.baseline - 0.15 * row.size;
    const start = text.length + (s.length - s.trimStart().length);
    text += s;
    if (isSup) sups.push({ start, end: start + s.trim().length, text: s.trim() });
    const chars = s.trim().length;
    allChars += chars;
    if (it.bold) boldChars += chars;
    x0 = Math.min(x0, it.x);
    x1 = Math.max(x1, it.x + Math.max(it.w, 0));
    top = Math.min(top, it.y - it.h);
    bottom = Math.max(bottom, it.y + 0.25 * it.h);
    prev = it;
  }
  return { text, sups, bold: allChars > 0 && boldChars / allChars >= 0.5, x0, x1, top, bottom };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

function regionOf(b: Built, page: PdfTextPage): Region {
  const W = page.width > 0 ? page.width : 1;
  const H = page.height > 0 ? page.height : 1;
  const x = clamp01(b.x0 / W);
  const y = clamp01(b.top / H);
  return {
    x: round4(x),
    y: round4(y),
    w: round4(clamp01(b.x1 / W) - x),
    h: round4(clamp01(b.bottom / H) - y),
  };
}

function positionOf(b: Built, page: PdfTextPage): Cue['position'] {
  if (page.width <= 0) return 'unknown';
  const mid = (b.x0 + b.x1) / 2 / page.width;
  const span = (b.x1 - b.x0) / page.width;
  if (span < 0.6 && Math.abs(mid - 0.5) < 0.05) return 'center';
  return 'left';
}

/** Split an over-long row at whitespace, like the HTML adapter (never reject). */
function splitLong(text: string): string[] {
  if (text.length <= limits.maxLineChars) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > limits.maxLineChars) {
    let cut = rest.lastIndexOf(' ', limits.maxLineChars);
    if (cut <= 0) cut = limits.maxLineChars;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Positioned text pages -> Line[] (see the module comment). Deterministic. */
export function pdfPagesToLines(pages: readonly PdfTextPage[]): PdfLinesResult {
  const built = pages.map((page) => {
    const textChars = nonSpaceChars(page.items);
    const scan = textChars < MIN_TEXT_CHARS;
    return { page, textChars, scan, rows: scan ? [] : clusterRows(page.items).map(buildRow) };
  });
  // Indent is measured from the leftmost text edge of the whole document (left margin = 0).
  let minX = Infinity;
  for (const b of built) for (const r of b.rows) minX = Math.min(minX, r.x0);
  if (!Number.isFinite(minX)) minX = 0;

  const perPage: Line[][] = built.map(({ page, rows }) => {
    const lines: Line[] = [];
    for (const r of rows) {
      const text = r.text.trim();
      if (!text) continue;
      const region = regionOf(r, page);
      const pageNo = page.index + 1;
      const parts = splitLong(text);
      const lead = r.text.length - r.text.trimStart().length;
      let base = 0;
      for (const part of parts) {
        const cue: Cue = {
          bold: r.bold,
          caps: isCaps(part),
          indent: Math.max(0, Math.round(r.x0 - minX)),
          position: positionOf(r, page),
          page: pageNo,
          region,
        };
        const line: Line = { text: part, cue, page: pageNo, region };
        const at = text.indexOf(part, base);
        setSupSegments(
          line,
          r.sups
            .map((s) => ({ start: s.start - lead - at, end: s.end - lead - at, text: s.text }))
            .filter((s) => s.start >= 0 && s.end <= part.length),
        );
        base = at + part.length;
        lines.push(line);
      }
    }
    return lines;
  });

  const noise = stripPageNoise(perPage);
  const out: PdfPageLines[] = built.map((b, i) => ({
    index: b.page.index,
    scan: b.scan,
    textChars: b.textChars,
    lines: noise.pages[i]!,
    dropped: noise.dropped[i]!,
  }));
  return {
    lines: out.flatMap((p) => p.lines),
    scanPages: out.filter((p) => p.scan).map((p) => p.index),
    pages: out,
  };
}
