import type { DocGraph } from '../graph/graph';
import { mask, sensitiveSpans } from '../memory/mask';
import { snapToSentence } from '../memory/snap';
import type { ExplainFacts } from './registry';

/** Shared helpers for the Phase 02 detectors (pure, linear-time). */

export function textOf(g: DocGraph, blockIndex: number): string {
  return g.structure.blocks[blockIndex]!.lines.map((l) => l.text).join(' ');
}

/** Mask account/routing-like digit runs in any document-derived string (backlog R1). */
export function maskText(s: string): string {
  return mask(s, sensitiveSpans(s));
}

/** Longest string fact after masking (schema allows 1000; explain() embeds several facts). */
export const FACT_MAX_CHARS = 400;

/** Clip to n chars, ending with "…" when cut. Apply to already-masked text only. */
export function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + '…';
}

/** Mask first, then cut: a clip boundary can never split a sensitive run and leak its digits (F2). */
export function maskThenClip(s: string, n: number): string {
  return maskText(s).slice(0, n);
}

/** "a", "b", "c", "d", "e" and 20 more — bounded label lists for long option groups (F1). */
export function listLabels(labels: readonly string[], max = 5, each = 60): string {
  const shown = labels.slice(0, max).map((l) => `"${maskThenClip(l, each)}"`);
  const rest = labels.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

/** Mask every string fact (then clamp to FACT_MAX_CHARS); numbers, booleans and null pass through. */
export function maskFacts(f: ExplainFacts): ExplainFacts {
  const out: ExplainFacts = {};
  for (const [k, v] of Object.entries(f))
    out[k] = typeof v === 'string' ? clip(maskText(v), FACT_MAX_CHARS) : v;
  return out;
}

/** Fact as display text: missing / null facts never print `undefined` (total explain()). */
export function fact(f: ExplainFacts, key: string, fallback = 'not stated'): string {
  const v = f[key];
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

/** Section label for a block ("Section 4" / scope title / "the document"). */
export function whereOf(g: DocGraph, blockIndex: number): string {
  const info = g.structure.info[blockIndex];
  if (info?.section) {
    const part = info.part ? `, Part ${info.part.letter}` : '';
    return `Section ${info.section.number}${part}`;
  }
  if (info && info.scope.kind !== 'body') return maskThenClip(info.scope.title, 80);
  return 'the document';
}

export interface SentenceHit<T> {
  blockIndex: number;
  /** Sentence bounds in block text. */
  start: number;
  end: number;
  /** Match offsets of the first hit (buildFinding snaps to the same sentence). */
  matchStart: number;
  matchEnd: number;
  items: T[];
}

/**
 * Group hits by (block, enclosing sentence) so two hits in one sentence become ONE finding
 * (finding ids are anchor-based; two findings on one sentence would be de-duplicated by id).
 */
export function groupBySentence<T>(
  g: DocGraph,
  hits: Array<{ blockIndex: number; start: number; end: number; item: T }>,
): SentenceHit<T>[] {
  const out: SentenceHit<T>[] = [];
  const byKey = new Map<string, SentenceHit<T>>();
  const texts = new Map<number, string>();
  let last: { blockIndex: number; start: number; end: number } | null = null;
  for (const h of hits) {
    // hits arrive in document order: reuse the previous sentence when the hit lies inside it
    // (keeps many hits in one long sentence linear instead of one full snap per hit)
    let snap: { start: number; end: number };
    if (last && last.blockIndex === h.blockIndex && h.start >= last.start && h.end <= last.end) {
      snap = last;
    } else {
      let text = texts.get(h.blockIndex);
      if (text === undefined) {
        text = textOf(g, h.blockIndex);
        texts.set(h.blockIndex, text);
      }
      const s = snapToSentence(text, h.start, h.end);
      snap = { start: s.start, end: s.end };
      last = { blockIndex: h.blockIndex, start: s.start, end: s.end };
    }
    const key = `${h.blockIndex}|${snap.start}|${snap.end}`;
    let s = byKey.get(key);
    if (!s) {
      s = {
        blockIndex: h.blockIndex,
        start: snap.start,
        end: snap.end,
        matchStart: h.start,
        matchEnd: h.end,
        items: [],
      };
      byKey.set(key, s);
      out.push(s);
    }
    s.items.push(h.item);
  }
  return out;
}

export interface SectionIndex {
  all: Set<string>;
  byScope: Map<string, Set<string>>;
  parts: Map<string, Set<string>>;
}
const sectionIndexCache = new WeakMap<DocGraph, SectionIndex>();

/** Accepted section numbers per scope id, and the set of all section numbers (memoized per graph). */
export function sectionIndex(g: DocGraph): SectionIndex {
  const hit = sectionIndexCache.get(g);
  if (hit) return hit;
  const all = new Set<string>();
  const byScope = new Map<string, Set<string>>();
  const parts = new Map<string, Set<string>>();
  for (const sc of g.structure.scopes) {
    const set = new Set<string>();
    for (const s of sc.sections) {
      set.add(s.number);
      all.add(s.number);
      const p = parts.get(s.number) ?? new Set<string>();
      for (const x of s.parts) p.add(x.letter);
      parts.set(s.number, p);
    }
    byScope.set(sc.id, set);
  }
  const idx = { all, byScope, parts };
  sectionIndexCache.set(g, idx);
  return idx;
}
