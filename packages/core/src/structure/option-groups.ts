import { sha256Hex } from '../model/hash';
import type { Block } from '../model/types';
import { EXCLUSIVITY_CUES, supSegmentsOf } from '../adapters/html';
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

/**
 * Option groups: consecutive blocks containing checkbox glyphs. The group is
 * exclusive when an exclusivity cue appears in the group or in the nearest
 * preceding non-option block.
 */
export function extractOptionGroups(blocks: Block[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  let current: { idx: number[]; opts: OptionItem[] } | null = null;
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
      groups.push(g);
    }
    current = null;
  };
  blocks.forEach((b, bi) => {
    const text = b.lines.map((l) => l.text).join(' ');
    const opts = BOX.test(text) ? splitOptions(text) : [];
    if (opts.length) {
      current = current ?? { idx: [], opts: [] };
      current.idx.push(bi);
      const markers = footnoteMarkers(b);
      opts.forEach((o, i) => {
        const item: OptionItem = { ...o, blockIndex: bi };
        const m = markers[i];
        if (m) item.footnote_marker = m;
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
