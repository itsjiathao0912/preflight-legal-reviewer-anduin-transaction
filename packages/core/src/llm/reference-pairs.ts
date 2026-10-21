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
 * (exact prefix) followed by ONE `[TARGET ...]` block and an optional `[NOTE ...]` line. A pointer
 * that names several labels ("Section G ... Section H") yields one pair per label (at most 3), so
 * the model judges each label against its own target; the NOTE says which other labels the
 * pointer names, which duplicate heading was chosen and whether the pointer sits inside its own
 * target. The candidate site is the pointer sentence only, so the verify chain accepts a model
 * quote copied from the pointer and rejects one copied from the TARGET block.
 *
 * The structurer has no letter-labelled section model, so this module resolves labels itself from
 * block text (lettered-heading resolver):
 *  - heading shapes: label plus title in one block (`E. Supplemental Data for Entities`,
 *    `PART C: SUBSCRIPTION AGREEMENT`) or a bare label block (`A.`) whose title is the next block;
 *  - paragraph / heading blocks are top-level entries; lettered `field` blocks (`E. Related
 *    Parties:`) are nested entries used only when no top-level entry has the label, so nested
 *    `A.`/`B.` items never shadow a top-level label;
 *  - duplicate labels keep every entry; the one in the pointer's own scope (first section_path
 *    element) wins, else the first entry.
 */

export const POINTER_MAX_CHARS = 500;
export const TARGET_HEADING_MAX_CHARS = 150;
/** label+heading+excerpt budget of the TARGET block (the NOTE length is taken from it). */
export const TARGET_CONTENT_BUDGET = 420;
/** Labels judged per pointer sentence (one pair each). */
export const MAX_LABELS_PER_POINTER = 3;
export const NOTE_MAX_CHARS = 200;

type Family = 'section' | 'part' | 'annex' | 'appendix' | 'exhibit' | 'schedule';

interface HeadingEntry {
  family: Family;
  label: string;
  scope: string;
  title: string;
  blockIndex: number;
  /** lettered field block: a fallback, never shadows a top-level entry */
  nested: boolean;
}

const HEADING_RE =
  /^\s*(?:(SECTION|PART|ANNEX|APPENDIX|EXHIBIT|SCHEDULE)\s+([A-Z])\s*(?:[.:)–—-]|$)|([A-Z])[.)](?=\s|$))\s*([\s\S]*)$/i;

/**
 * Prefixed heading: a short non-routing block whose label sits after a few title words
 * (`Subscriber Questionnaire Section A: General Information`). Label must be followed by `:`,
 * `.` or a dash and a title.
 */
const PREFIXED_HEADING_RE =
  /^(.{1,60}?)\b(SECTION|PART|ANNEX|APPENDIX|EXHIBIT|SCHEDULE)\s+([A-Z])\s*[:.–—-]\s*(\S[\s\S]*)$/i;
export const PREFIXED_HEADING_MAX_CHARS = 200;

/** Pointer mention: family word then one or more single letters ("Section G", "Parts C and D"). */
const MENTION_RE =
  /\b(Sections?|Parts?|Annex(?:es)?|Appendix|Appendices|Exhibits?|Schedules?)\s+([A-Z])\b((?:\s*(?:,|and|or|&)\s*[A-Z]\b(?![.']\w))*)/g;

const ROUTING_RE =
  /\b(?:proceed(?:s|ing)?\s+to|respond(?:s|ing)?\s+to|go\s+to|skip(?:s|ping)?|complet(?:e|es|ing)|provided\s+in|set\s+forth\s+in|indicated\s+in|specified\s+in|see|answer(?:s|ing)?|fill\s+(?:in|out))\b/i;

/** Unit words in Title or UPPER case (labels stay case-sensitive: a capital letter, roman or digits). */
const unitAlt = (words: readonly string[]) => words.flatMap((w) => [w, w.toUpperCase()]).join('|');
const UNIT = `(?:${unitAlt(['Sections?', 'Parts?', 'Annex(?:es)?', 'Appendix', 'Appendices', 'Exhibits?', 'Schedules?', 'Articles?'])})`;
const CONTAINER = `(${unitAlt(['Exhibit', 'Annex', 'Appendix', 'Schedule', 'Part'])})`;
const LABEL = '(?:[A-Z]|[IVX]+|\\d+)\\b';
const QUALIFIED_AFTER_RE = new RegExp(
  `^\\s*(?:of|in|to)\\s+(?:this\\s+|the\\s+)?${UNIT}\\s+${LABEL}`,
);
const QUALIFIED_BEFORE_RE = new RegExp(`\\b${CONTAINER}\\s+${LABEL}\\s*,\\s*$`);
const PROVISION_CHAIN_RE =
  /^\s*,\s*(?:Sections?|SECTIONS?|Paragraphs?|PARAGRAPHS?|Items?|ITEMS?|Clauses?|CLAUSES?)\s+\d/;
/** the container half of "Part A of Section I": the phrase names the nested unit, skipped whole */
const CONTAINER_OF_RE = new RegExp(`\\b${UNIT}\\s+${LABEL}\\s+(?:of|in)\\s+(?:this\\s+|the\\s+)?$`);

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
    if (b.kind !== 'paragraph' && b.kind !== 'heading' && b.kind !== 'field') continue;
    const text = blockText(g, i);
    if (text.length === 0) continue;
    let m = HEADING_RE.exec(text);
    let family: Family;
    let label: string;
    if (m) {
      family = m[1] ? familyOf(m[1]) : 'section';
      label = (m[2] ?? m[3] ?? '').toUpperCase();
    } else {
      const p = text.length <= PREFIXED_HEADING_MAX_CHARS ? PREFIXED_HEADING_RE.exec(text) : null;
      if (!p || ROUTING_RE.test(text) || /\b(?:of|in|to|see)\s*$/i.test(p[1]!)) continue;
      family = familyOf(p[2]!);
      label = p[3]!.toUpperCase();
      m = p; // both shapes carry the title in group 4
    }
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
    out.push({
      family,
      label,
      scope: b.section_path[0] ?? '',
      title,
      blockIndex: i,
      nested: b.kind === 'field',
    });
  }
  return out;
}

interface Pick {
  entry: HeadingEntry;
  /** entries in the pool the pick came from (same family and label) */
  pool: HeadingEntry[];
  sameScope: boolean;
}

/**
 * Duplicate-label rule: top-level entries first (same-scope entry, else the first), then nested
 * entries the same way; undefined = NOT FOUND.
 */
function pickEntry(
  entries: readonly HeadingEntry[],
  family: Family,
  label: string,
  scope: string,
): Pick | undefined {
  const all = entries.filter((e) => e.family === family && e.label === label);
  const top = all.filter((e) => !e.nested);
  const pool = top.length > 0 ? top : all;
  const same = pool.find((e) => e.scope === scope);
  const entry = same ?? pool[0];
  return entry ? { entry, pool, sameScope: same !== undefined } : undefined;
}

/** Block index where the section of `e` ends (next same-family heading of the same level). */
function sectionEnd(g: DocGraph, e: HeadingEntry, entries: readonly HeadingEntry[]): number {
  const next = entries.find(
    (x) => x.family === e.family && x.nested === e.nested && x.blockIndex > e.blockIndex,
  );
  return next ? next.blockIndex : g.structure.blocks.length;
}

/** First chars of the target section: heading block remainder plus following blocks. */
function excerptOf(
  g: DocGraph,
  e: HeadingEntry,
  entries: readonly HeadingEntry[],
  max: number,
): string {
  const stop = sectionEnd(g, e, entries);
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
    // qualified sub-reference: "Part A of Section I", "Section C of Annex I to ..." names a unit
    // inside another lettered/numbered unit, not a top-level heading of this document (both halves
    // of the phrase are skipped: the resolver only knows top-level single labels)
    if (QUALIFIED_AFTER_RE.test(after)) continue;
    // "Part A, Section 18(b) of Annex A", "Part A, Paragraph 14(e)": a numbered provision chain
    if (PROVISION_CHAIN_RE.test(after)) continue;
    const head = sentence.slice(0, m.index);
    if (CONTAINER_OF_RE.test(head)) continue;
    // statute or regulation context right after the mention (pinned algorithm S)
    if (localStatutoryRule(after, '') !== null) continue;
    const family = familyOf(m[1]!);
    // "Exhibit C, Section I": a unit inside another exhibit/annex/schedule/appendix/part (a list
    // of the same family, "Section A, Section B", is not a qualifier)
    const before = QUALIFIED_BEFORE_RE.exec(head);
    if (before && familyOf(before[1]!) !== family) continue;
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

const nameOf = (m: Mention) => `${familyWord[m.family]} ${m.label}`;

/**
 * TARGET block plus an optional NOTE line for one (pointer, label) pair. The NOTE states facts the
 * model cannot see from one excerpt: the other labels of the pointer, the duplicate-label choice
 * (resolver rule) and whether the pointer sentence sits inside the target section.
 */
function targetFor(
  g: DocGraph,
  entries: readonly HeadingEntry[],
  m: Mention,
  others: readonly Mention[],
  scope: string,
  pointerBlock: number,
): string {
  const name = nameOf(m);
  const p = pickEntry(entries, m.family, m.label, scope);
  const notes: string[] = [];
  if (others.length > 0)
    notes.push(`the pointer also names ${others.map(nameOf).join(', ')}; judge only ${name} here`);
  if (p && p.pool.length > 1) {
    const rest = p.pool
      .filter((x) => x !== p.entry)
      .map((x) => x.title.slice(0, 40))
      .join('; ');
    notes.push(
      `${name} appears ${p.pool.length} times; shown: ` +
        (p.sameScope
          ? `the one in the pointer's own part`
          : `the first (none in the pointer's own part)`) +
        `; others: ${rest}`,
    );
  }
  if (!p) {
    const found = [...new Set(entries.filter((e) => e.family === m.family).map((e) => e.label))]
      .sort()
      .join(', ');
    notes.push(`${familyWord[m.family]} labels found in this document: ${found || 'none'}`);
  }
  if (p && pointerBlock > p.entry.blockIndex && pointerBlock < sectionEnd(g, p.entry, entries))
    notes.push(`the pointer sentence itself is inside ${name}`);
  const note = notes.length > 0 ? `[NOTE: ${notes.join('. ')}]`.slice(0, NOTE_MAX_CHARS) : '';
  const budget = TARGET_CONTENT_BUDGET - note.length;
  let block: string;
  if (!p) block = `[TARGET ${name}: NOT FOUND]`;
  else {
    const headingMax = Math.min(TARGET_HEADING_MAX_CHARS, Math.max(20, budget - name.length - 3));
    const heading = p.entry.title.slice(0, headingMax);
    const rest = Math.max(0, budget - name.length - heading.length - 3);
    const excerpt = excerptOf(g, p.entry, entries, rest);
    block = `[TARGET ${name}: ${heading}${excerpt ? ` | ${excerpt}` : ''}]`;
  }
  return note ? `${block}\n${note}` : block;
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
        .slice(0, MAX_LABELS_PER_POINTER);
      if (mentions.length === 0) continue;
      if (ruleSpans.get(bi)?.some(([rs, re]) => rangesOverlap(snap.start, snap.end, rs, re)))
        continue;
      const scope = block.section_path[0] ?? '';
      const pointer = sentence.slice(0, POINTER_MAX_CHARS);
      for (const m of mentions) {
        if (candidates.length >= cap) break;
        const others = mentions.filter((x) => x !== m);
        const packed = [pointer, targetFor(g, entries, m, others, scope, bi)].join('\n');
        const quote = mask(packed, sensitiveSpans(packed)).slice(0, limits.quoteMaxChars);
        if (quote.trim().length === 0) continue;
        const id = 'r_' + sha256Hex(`${s.docHash}|ref|${key}|${m.family}:${m.label}`).slice(0, 16);
        candidates.push({
          id,
          quote,
          section_path: block.section_path.slice(0, 8).map((x) => x.slice(0, 300)),
          issue_class_hint: 'broken_cross_reference',
        });
        sites.push({ id, blockIndex: bi, start: snap.start, end: snap.end });
      }
    }
  }
  return { candidates, sites };
}
