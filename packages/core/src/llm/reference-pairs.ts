import { limits } from '../config/limits';
import type { AiCandidate } from '../contracts/ai';
import type { Finding } from '../findings/schema';
import type { DocGraph } from '../graph/graph';
import { mask, sensitiveSpans } from '../memory/mask';
import { snapToSentence } from '../memory/snap';
import { sha256Hex } from '../model/hash';
import { localStatutoryRule } from '../structure/statutory';
import type { AiCandidateSite } from './candidates';
import { rangesOverlap } from './dedupe';

/**
 * Reference-target evidence pairs (pure function of the DocGraph plus the deterministic findings).
 *
 * A pair is one routing sentence that points at a lettered Section / Part / Annex / Appendix /
 * Exhibit / Schedule of this document ("should proceed to Section H") plus the heading and first
 * lines of the section it points to. The packed candidate `quote` is the pointer sentence verbatim
 * (exact prefix) followed by one `[TARGET ...]` block per named label (at most 3). The candidate
 * site is the pointer sentence only, so the verify chain accepts a model quote copied from the
 * pointer and rejects one copied from the TARGET block.
 *
 * The structurer has no letter-labelled section model, so this module resolves labels itself from
 * block text (lettered-heading resolver):
 *  - heading shapes: label plus title in one block (`E. Supplemental Data for Entities`,
 *    `PART C: SUBSCRIPTION AGREEMENT`) or a bare label block (`A.`) whose title is the next block;
 *  - only paragraph / heading blocks count (nested `A.`/`B.` field or list items never shadow a
 *    top-level label);
 *  - duplicate labels keep every entry; the one in the pointer's own scope (first section_path
 *    element) wins, else the first entry.
 */

export const POINTER_MAX_CHARS = 500;
export const TARGET_HEADING_MAX_CHARS = 150;
/** Shared label+heading+excerpt budget across the TARGET blocks of one pair. */
export const TARGET_CONTENT_BUDGET = 420;
export const MAX_TARGETS_PER_PAIR = 3;

type Family = 'section' | 'part' | 'annex' | 'appendix' | 'exhibit' | 'schedule';

interface HeadingEntry {
  family: Family;
  label: string;
  scope: string;
  title: string;
  blockIndex: number;
}

const HEADING_RE =
  /^\s*(?:(SECTION|PART|ANNEX|APPENDIX|EXHIBIT|SCHEDULE)\s+([A-Z])\s*(?:[.:)–—-]|$)|([A-Z])[.)](?=\s|$))\s*([\s\S]*)$/i;

/** Pointer mention: family word then one or more single letters ("Section G", "Parts C and D"). */
const MENTION_RE =
  /\b(Sections?|Parts?|Annex(?:es)?|Appendix|Appendices|Exhibits?|Schedules?)\s+([A-Z])\b((?:\s*(?:,|and|or|&)\s*[A-Z]\b(?![.']\w))*)/g;

const ROUTING_RE =
  /\b(?:proceed(?:s|ing)?\s+to|respond(?:s|ing)?\s+to|go\s+to|skip(?:s|ping)?|complet(?:e|es|ing)|provided\s+in|set\s+forth\s+in|indicated\s+in|specified\s+in|see|answer(?:s|ing)?|fill\s+(?:in|out))\b/i;

/** Sentences about IRS forms refer to the form's parts, not this document (NOT-A-DEFECT N3). */
const IRS_FORM_RE = /\b(?:W-8[A-Z-]*|W-9|IRS|Internal Revenue Service|Form\s+\d{3,4})\b/i;

function familyOf(word: string): Family {
  const w = word.toLowerCase();
  if (w.startsWith('section')) return 'section';
  if (w.startsWith('part')) return 'part';
  if (w.startsWith('annex')) return 'annex';
  if (w.startsWith('append')) return 'appendix';
  if (w.startsWith('exhibit')) return 'exhibit';
  return 'schedule';
}

const familyWord: Record<Family, string> = {
  section: 'Section',
  part: 'Part',
  annex: 'Annex',
  appendix: 'Appendix',
  exhibit: 'Exhibit',
  schedule: 'Schedule',
};

function blockText(g: DocGraph, i: number): string {
  const b = g.structure.blocks[i];
  return b ? b.lines.map((l) => l.text).join(' ') : '';
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Scan document blocks in order and record every lettered heading entry. */
export function letteredHeadings(g: DocGraph): HeadingEntry[] {
  const out: HeadingEntry[] = [];
  const blocks = g.structure.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind !== 'paragraph' && b.kind !== 'heading') continue;
    const text = blockText(g, i);
    if (text.length === 0) continue;
    const m = HEADING_RE.exec(text);
    if (!m) continue;
    const family: Family = m[1] ? familyOf(m[1]) : 'section';
    const label = (m[2] ?? m[3] ?? '').toUpperCase();
    if (!label) continue;
    let title = squash(m[4] ?? '');
    if (title.length === 0) {
      // bare label block: the title is the next non-empty block
      for (let j = i + 1; j < Math.min(blocks.length, i + 4); j++) {
        const t = squash(blockText(g, j));
        if (t.length > 0) {
          title = t;
          break;
        }
      }
    }
    if (title.length === 0) continue;
    out.push({ family, label, scope: b.section_path[0] ?? '', title, blockIndex: i });
  }
  return out;
}

/** Duplicate-label rule: same-scope entry first, else the first entry; undefined = NOT FOUND. */
function pickEntry(
  entries: readonly HeadingEntry[],
  family: Family,
  label: string,
  scope: string,
): HeadingEntry | undefined {
  const all = entries.filter((e) => e.family === family && e.label === label);
  return all.find((e) => e.scope === scope) ?? all[0];
}

/** First chars of the target section: heading block remainder plus following blocks. */
function excerptOf(
  g: DocGraph,
  e: HeadingEntry,
  entries: readonly HeadingEntry[],
  max: number,
): string {
  const next = entries.find((x) => x.family === e.family && x.blockIndex > e.blockIndex);
  const stop = next ? next.blockIndex : g.structure.blocks.length;
  const parts: string[] = [];
  let len = 0;
  for (let j = e.blockIndex + 1; j < stop && len < max; j++) {
    const t = squash(blockText(g, j));
    if (t.length === 0 || t === e.title) continue;
    parts.push(t);
    len += t.length + 1;
  }
  return squash(parts.join(' ')).slice(0, max);
}

interface Mention {
  family: Family;
  label: string;
}

function mentionsIn(sentence: string): Mention[] {
  const out: Mention[] = [];
  const seen = new Set<string>();
  MENTION_RE.lastIndex = 0;
  for (let m = MENTION_RE.exec(sentence); m; m = MENTION_RE.exec(sentence)) {
    const after = sentence.slice(m.index + m[0].length);
    // "Part B of Section 4": a part of a numbered section (engine-owned R/L algorithms)
    if (/^\s*of\s+(?:this\s+)?Section\s+\d/i.test(after)) continue;
    // statute or regulation context right after the mention (pinned algorithm S)
    if (localStatutoryRule(after, '') !== null) continue;
    const family = familyOf(m[1]!);
    const labels = [m[2]!, ...(m[3] ?? '').split(/[^A-Z]+/).filter((x) => x.length === 1)];
    for (const label of labels) {
      const k = `${family}:${label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ family, label });
    }
  }
  return out;
}

function targetBlock(
  g: DocGraph,
  entries: readonly HeadingEntry[],
  m: Mention,
  scope: string,
  budget: number,
): string {
  const name = `${familyWord[m.family]} ${m.label}`;
  const e = pickEntry(entries, m.family, m.label, scope);
  if (!e) return `[TARGET ${name}: NOT FOUND]`;
  const headingMax = Math.min(TARGET_HEADING_MAX_CHARS, Math.max(20, budget - name.length - 3));
  const heading = e.title.slice(0, headingMax);
  const rest = Math.max(0, budget - name.length - heading.length - 3);
  const excerpt = excerptOf(g, e, entries, rest);
  return `[TARGET ${name}: ${heading}${excerpt ? ` | ${excerpt}` : ''}]`;
}

/**
 * Build reference-target candidates (packed pointer + TARGET blocks) and their pointer sites.
 * Deterministic, masked, rule-overlapped pointers skipped, document order, ids `r_` + 16 hex,
 * capped at `max` (limits.aiCandidates).
 */
export function buildReferencePairs(
  g: DocGraph,
  findings: readonly Finding[],
  max: number = limits.aiCandidates,
): { candidates: AiCandidate[]; sites: AiCandidateSite[] } {
  const s = g.structure;
  const cap = Math.max(0, Math.min(max, limits.aiCandidates));
  if (cap === 0) return { candidates: [], sites: [] };
  const entries = letteredHeadings(g);
  if (entries.length === 0) return { candidates: [], sites: [] };
  const families = new Set(entries.map((e) => e.family));

  const blockIndexById = new Map(s.blocks.map((b, i) => [b.id, i] as const));
  const ruleSpans = new Map<number, [number, number][]>();
  for (const f of findings) {
    if (f.detector_kind !== 'rule') continue;
    const bi = blockIndexById.get(f.anchor.blockId);
    if (bi === undefined) continue;
    const list = ruleSpans.get(bi) ?? [];
    list.push([f.anchor.offsetStart, f.anchor.offsetEnd]);
    ruleSpans.set(bi, list);
  }
  const headingBlocks = new Set(entries.map((e) => e.blockIndex));

  const candidates: AiCandidate[] = [];
  const sites: AiCandidateSite[] = [];
  const seen = new Set<string>();
  for (let bi = 0; bi < s.blocks.length && candidates.length < cap; bi++) {
    const block = s.blocks[bi]!;
    if (block.kind === 'heading' || headingBlocks.has(bi)) continue;
    const text = blockText(g, bi);
    if (text.trim().length === 0) continue;
    MENTION_RE.lastIndex = 0;
    const starts: number[] = [];
    for (let m = MENTION_RE.exec(text); m; m = MENTION_RE.exec(text)) starts.push(m.index);
    for (const at of starts) {
      if (candidates.length >= cap) break;
      const snap = snapToSentence(text, at, at + 1);
      const key = `${block.id}:${snap.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sentence = snap.quote;
      if (!ROUTING_RE.test(sentence) || IRS_FORM_RE.test(sentence)) continue;
      const mentions = mentionsIn(sentence)
        .filter((m) => families.has(m.family))
        .slice(0, MAX_TARGETS_PER_PAIR);
      if (mentions.length === 0) continue;
      if (ruleSpans.get(bi)?.some(([rs, re]) => rangesOverlap(snap.start, snap.end, rs, re)))
        continue;
      const scope = block.section_path[0] ?? '';
      const per = Math.floor(TARGET_CONTENT_BUDGET / mentions.length);
      const targets = mentions.map((m) => targetBlock(g, entries, m, scope, per));
      const pointer = sentence.slice(0, POINTER_MAX_CHARS);
      const packed = [pointer, ...targets].join('\n');
      const quote = mask(packed, sensitiveSpans(packed)).slice(0, limits.quoteMaxChars);
      if (quote.trim().length === 0) continue;
      const id = 'r_' + sha256Hex(`${s.docHash}|ref|${key}`).slice(0, 16);
      candidates.push({
        id,
        quote,
        section_path: block.section_path.slice(0, 8).map((x) => x.slice(0, 300)),
        issue_class_hint: 'broken_cross_reference',
      });
      sites.push({ id, blockIndex: bi, start: snap.start, end: snap.end });
    }
  }
  return { candidates, sites };
}
