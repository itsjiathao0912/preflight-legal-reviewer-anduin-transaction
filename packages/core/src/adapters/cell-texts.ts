import type { Line } from '../model/types';

/**
 * TS-only side channel (like sup-segments.ts): the per-cell texts of a merged table-row Line.
 * The HTML adapter merges all cells of a <tr> into one space-separated Line; the cell texts
 * (whitespace-collapsed, glyph-normalized, empty cells kept as '') are recorded here so the
 * structurer can tell a label column from an "Instructions" column. Not part of LineSchema
 * (contracts snapshot unchanged); recorded only for rows with >= 2 non-empty cells whose text
 * was not split by splitLong.
 */
const CELL_TEXTS = new WeakMap<Line, readonly string[]>();

/** Cell texts recorded for a Line (empty for non-table lines). */
export function cellTextsOf(line: Line | undefined): readonly string[] {
  return (line && CELL_TEXTS.get(line)) ?? [];
}

export function setCellTexts(line: Line, cells: readonly string[]): void {
  if (cells.filter((c) => c !== '').length >= 2) CELL_TEXTS.set(line, cells);
}
