import { sha256Hex } from '../model/hash';
import type { Block } from '../model/types';
import { EXCLUSIVITY_CUES } from '../adapters/html';
import { supSegmentsOf } from '../adapters/sup-segments';
import { cellTextsOf } from '../adapters/cell-texts';
import type { OptionGroup, OptionItem } from './types';

const BOX = /[☐☒]/;

/** Split a line into checkbox options ("☐ A ☐ B" -> [A, B]). */
export function splitOptions(text: string): Array<{ label: string; checked: boolean }> {
  const out: Array<{ label: string; checked: boolean }> = [];
  const parts = text.split(/(?=[☐☒])/);
  for (const p of parts) {
    if (!BOX.test(p[0] ?? '')) continue;
    const label = p.slice(1).trim();
    if (label) out.push({ label, checked: p[0] === '☒' });
  }
  return out;
}

/**
 * Footnote markers per option label (A3): a <sup> segment recorded by the HTML adapter that ends
 * exactly where the option label ends. Labels are located with the same split as splitOptions.
 */
export function footnoteMarkers(block: Block): Array<string | undefined> {
  const line = block.lines[0];
  const sups = supSegmentsOf(line);
  const out: Array<string | undefined> = [];
  const text = block.lines.map((l) => l.text).join(' ');
  let pos = 0;
  for (const p of text.split(/(?=[☐☒])/)) {
    const start = pos;
    pos += p.length;
    if (!BOX.test(p[0] ?? '')) continue;
    const label = p.slice(1).trim();
    if (!label) continue;
    if (!sups.length || block.lines.length !== 1) {
      out.push(undefined);
      continue;
    }
    const lead = p.slice(1).length - p.slice(1).trimStart().length;
    const end = start + 1 + lead + label.length;
    out.push(
      sups.find((s) => s.end === end || (s.end < end && text.slice(s.end, end).trim() === ''))
        ?.text,
    );
  }
  return out;
}

/** A cell that routes the investor elsewhere ("Please complete Part A of Section 6"). */
export const INSTRUCTION_CELL_RE =
  /^(?:please\s+)?(?:complete|proceed\s+to|go\s+to|skip|see|provide|do\s+not\s+complete)\b/i;
/** A table header naming an instructions column. */
export const INSTRUCTION_HEADER_RE = /^instructions?$/i;
/** Header words that name the checkbox column, not the question ("Select one", "Mark"). */
const SELECT_HEADER_RE =
  /^(?:select|mark|tick|check)(?:\s+(?:one|only\s+one|all\s+that\s+apply|one\s+only))?$/i;

interface RowSplit {
  label: string;
  instruction: string;
  labelCell: number;
}

/**
 * Split a one-checkbox table row into its label cell and an instruction column. Applies only when
 * a cell after the label cell is instruction-like (matches INSTRUCTION_CELL_RE or sits under an
 * "Instructions" header); otherwise null and the merged row text stays the label.
 */
export function splitInstructionRow(
  cells: readonly string[],
  header: readonly string[] | undefined,
): RowSplit | null {
  const labelCell = labelCellOf(cells);
  if (labelCell === null) return null;
  const label = cells[labelCell]!.replace(/^[☐☒]\s*/, '').trim();
  if (!label) return null;
  const instr: string[] = [];
  for (let k = labelCell + 1; k < cells.length; k++) {
    const c = cells[k]!.trim();
    if (!c) continue;
    const underHeader =
      header?.length === cells.length && INSTRUCTION_HEADER_RE.test((header[k] ?? '').trim());
    if (!underHeader && !INSTRUCTION_CELL_RE.test(c)) return null;
    instr.push(c);
  }
  if (!instr.length) return null;
  return { label, instruction: instr.join(' '), labelCell };
}

/** Index of the label cell of a one-checkbox row (the box cell, or the cell after a bare box). */
export function labelCellOf(cells: readonly string[]): number | null {
  const box = cells.findIndex((c) => BOX.test(c));
  if (box < 0 || cells.slice(box + 1).some((c) => BOX.test(c))) return null;
  const own = cells[box]!.replace(/^[☐☒]\s*/, '').trim();
  if (BOX.test(own)) return null;
  if (own) return box;
  return box + 1 < cells.length ? box + 1 : null;
}

/** Longest cell of a column-header row (longer cells are body text in a layout table). */
export const HEADER_CELL_MAX = 60;

/**
 * A table column-header row: no checkbox, short cells with no closing punctuation, and either
 * >= 3 cells or a checkbox-column header first ("Check | Investor type"). Two-column layout rows
 * ("3. | Compile required documentation:") do not qualify.
 */
function headerCells(block: Block | undefined): readonly string[] | undefined {
  if (!block || block.lines.length !== 1) return undefined;
  const cells = cellTextsOf(block.lines[0]);
  if (cells.length < 2 || cells.some((c) => BOX.test(c))) return undefined;
  if (cells.some((c) => c.length > HEADER_CELL_MAX || /[.:;]$/.test(c))) return undefined;
  if (cells.length < 3 && !SELECT_HEADER_RE.test(cells[0]!.trim())) return undefined;
  return cells;
}

/**
 * Question from the header row: the label column header plus any later data-column headers,
 * without the checkbox column ("Select one") and the Instructions column
 * ("Select one | Investor type | Instructions" -> "Investor type").
 */
function questionFrom(header: readonly string[], labelCell: number): string | undefined {
  const own = (header[labelCell] ?? '').trim();
  if (!own || SELECT_HEADER_RE.test(own)) return undefined;
  const extra = header
    .slice(labelCell + 1)
    .map((c) => c.trim())
    .filter((c) => c && !INSTRUCTION_HEADER_RE.test(c) && !SELECT_HEADER_RE.test(c));
  return [own, ...extra].join(' — ');
}

/** Footnote marker ending a split label (a <sup> segment ending where the label cell text ends). */
function labelMarker(block: Block, label: string): string | undefined {
  const line = block.lines[0];
  const sups = supSegmentsOf(line);
  if (!sups.length || !line) return undefined;
  const at = line.text.indexOf(label);
  if (at < 0) return undefined;
  const end = at + label.length;
  return sups.find((s) => s.end === end)?.text;
}

/**
 * Option groups: consecutive blocks containing checkbox glyphs. The group is
 * exclusive when an exclusivity cue appears in the group or in the nearest
 * preceding non-option block.
 */
export function extractOptionGroups(blocks: Block[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  let current: {
    idx: number[];
    opts: OptionItem[];
    header?: readonly string[];
    question?: string;
  } | null = null;
  let lastCue: string | undefined;
  const close = () => {
    if (current && current.opts.length > 0) {
      const text = current.idx.map((i) => blocks[i]!.lines.map((l) => l.text).join(' ')).join(' ');
      const cueRe = EXCLUSIVITY_CUES.find((re) => re.test(text));
      const cue = cueRe ? cueRe.exec(text)![0] : lastCue;
      const g: OptionGroup = {
        id: 'opt_' + sha256Hex(current.idx.map((i) => blocks[i]!.id).join('|')).slice(0, 16),
        blockIndices: current.idx,
        options: current.opts,
        exclusive: cue !== undefined && !/all that apply/i.test(cue),
      };
      if (cue) g.cue = cue;
      if (current.question) g.question = current.question;
      groups.push(g);
    }
    current = null;
  };
  blocks.forEach((b, bi) => {
    const text = b.lines.map((l) => l.text).join(' ');
    const opts = BOX.test(text) ? splitOptions(text) : [];
    if (opts.length) {
      if (!current) {
        current = { idx: [], opts: [] };
        const header = headerCells(blocks[bi - 1]);
        if (header) current.header = header;
      }
      current.idx.push(bi);
      const markers = footnoteMarkers(b);
      const cells = b.lines.length === 1 ? cellTextsOf(b.lines[0]) : [];
      const split =
        opts.length === 1 && cells.length ? splitInstructionRow(cells, current.header) : null;
      opts.forEach((o, i) => {
        const item: OptionItem = { ...o, blockIndex: bi };
        if (current!.header && current!.opts.length === 0 && opts.length === 1) {
          const lc = labelCellOf(cells);
          const q =
            lc === null || current!.header.length !== cells.length
              ? undefined
              : questionFrom(current!.header, lc);
          if (q) current!.question = q;
        }
        if (split) {
          item.label = split.label;
          item.instruction = split.instruction;
          const m = labelMarker(b, split.label);
          if (m) item.footnote_marker = m;
        } else {
          const m = markers[i];
          if (m) item.footnote_marker = m;
        }
        current!.opts.push(item);
      });
    } else {
      close();
      const cueRe = EXCLUSIVITY_CUES.find((re) => re.test(text));
      lastCue = cueRe ? cueRe.exec(text)![0] : undefined;
    }
  });
  close();
  return groups;
}
