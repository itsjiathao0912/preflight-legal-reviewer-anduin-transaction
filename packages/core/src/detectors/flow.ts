import type { DocGraph } from '../graph/graph';
import type { Conditional } from '../structure/types';
import { sectionIndex } from './util';

/**
 * Shared flow model for broken-conditional, unreachable-flow and the investor path extractor.
 * Targets are parsed from the conditional `targets` strings ("Section 4", "Part C",
 * "Parts A & B of Section 2", "Part A or C of Section 2").
 */
export interface ParsedTarget {
  raw: string;
  section?: string;
  parts: string[];
}

const PARTS_OF_RE =
  /^Parts?\s+([A-Z](?:\s*(?:&|and|or|,)\s*[A-Z]){0,3})\s+of\s+Section\s+(\d{1,2}[A-Z]?)$/;
const SECTION_RE = /^Sections?\s+(\d{1,2}[A-Z]?)$/;
const PART_RE = /^Parts?\s+([A-Z])$/;

export function parseTarget(raw: string): ParsedTarget | null {
  const t = raw.trim();
  let m = PARTS_OF_RE.exec(t);
  if (m) return { raw: t, section: m[2]!, parts: m[1]!.split(/\s*(?:&|and|or|,)\s*/) };
  m = SECTION_RE.exec(t);
  if (m) return { raw: t, section: m[1]!, parts: [] };
  m = PART_RE.exec(t);
  if (m) return { raw: t, parts: [m[1]!] };
  return null;
}

/** "of Section N" / "of this Section" right after a bare part target in the block text. */
export const OF_SECTION_RE =
  /^\s{0,2}of\s{1,2}(?:(this)\s{1,2}Section\b|Section\s{1,2}(\d{1,2}[A-Z]?)\b)/;

/**
 * Parsed targets of a conditional. A bare "Part C" followed in the text by "of Section 3"
 * (or "of this Section") is resolved to that section; the structurer keeps only "Part C".
 */
export function conditionalTargets(g: DocGraph, c: Conditional): ParsedTarget[] {
  const text = g.structure.blocks[c.blockIndex]!.lines.map((l) => l.text).join(' ');
  const out: ParsedTarget[] = [];
  let from = c.start;
  for (const raw of c.targets) {
    const t = parseTarget(raw);
    if (!t) continue;
    if (t.section === undefined && t.parts.length === 1) {
      const re = new RegExp(`\\bParts?\\s{1,2}${t.parts[0]}\\b`, 'g');
      re.lastIndex = from;
      const m = re.exec(text);
      if (m && m.index <= c.end + 2) {
        from = m.index + m[0].length;
        const of = OF_SECTION_RE.exec(text.slice(from, from + 40));
        if (of) {
          const sec = of[1] ? g.structure.info[c.blockIndex]?.section?.number : of[2];
          if (sec) {
            out.push({ raw: `Part ${t.parts[0]} of Section ${sec}`, section: sec, parts: t.parts });
            continue;
          }
        }
      }
    }
    out.push(t);
  }
  return out;
}

export type TargetStatus = 'ok' | 'missing' | 'uncertain';

export interface TargetCheck {
  target: ParsedTarget;
  status: TargetStatus;
  /** What is missing ("Section 9", "Part D of Section 2"). */
  missing?: string;
}

/** Flow actions only: "see" is a cross-reference, not an instruction to fill something in. */
export function isFlowAction(c: Conditional): boolean {
  return c.action === 'complete' || c.action === 'skip' || c.action === 'proceed';
}

/**
 * Does the target exist? `uncertain` when the document gives no structural evidence either way
 * (no accepted sections at all, or a bare "Part X" in a document without recognized parts).
 */
export function checkTarget(g: DocGraph, c: Conditional, t: ParsedTarget): TargetCheck {
  const idx = sectionIndex(g);
  if (t.section !== undefined) {
    if (idx.all.size === 0) return { target: t, status: 'uncertain' };
    if (!idx.all.has(t.section))
      return { target: t, status: 'missing', missing: `Section ${t.section}` };
    if (t.parts.length === 0) return { target: t, status: 'ok' };
    const have = idx.parts.get(t.section) ?? new Set<string>();
    if (have.size === 0) return { target: t, status: 'uncertain' };
    const lost = t.parts.filter((p) => !have.has(p));
    return lost.length
      ? {
          target: t,
          status: 'missing',
          missing: `Part ${lost.join(' and ')} of Section ${t.section}`,
        }
      : { target: t, status: 'ok' };
  }
  // bare "Part X": the enclosing section's parts first, then any part anywhere
  const anyParts = [...idx.parts.values()].some((s) => s.size > 0);
  const partScopes = g.structure.scopes.filter((s) => s.kind === 'part').map((s) => s.title);
  if (!anyParts && partScopes.length === 0) return { target: t, status: 'uncertain' };
  const letter = t.parts[0]!;
  const enc = g.structure.info[c.blockIndex]?.section;
  if (enc && enc.parts.some((p) => p.letter === letter)) return { target: t, status: 'ok' };
  if ([...idx.parts.values()].some((s) => s.has(letter))) return { target: t, status: 'ok' };
  if (partScopes.some((title) => new RegExp(`^\\s*Part\\s+${letter}\\b`, 'i').test(title)))
    return { target: t, status: 'ok' };
  return { target: t, status: 'missing', missing: `Part ${letter}` };
}

/** Section number enclosing a block (same numbering scope), if any. */
export function sectionOfBlock(g: DocGraph, blockIndex: number): string | undefined {
  return g.structure.info[blockIndex]?.section?.number;
}
