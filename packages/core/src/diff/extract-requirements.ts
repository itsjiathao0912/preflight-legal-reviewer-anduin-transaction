import type { Unit } from './align';
import { excerptOf } from './diff-text';
import { renameNorm } from './rename-inference';
import type { Rename, RequirementDiff } from './types';

/** Sentence ranges of one block: split at "." / ";" / "!" / "?" followed by whitespace or the end. */
export function sentenceRanges(text: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const m of text.matchAll(/(?:[^.;!?]|[.;!?](?!\s|$))+[.;!?]*/g)) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) out.push({ start: m.index! + lead, end: m.index! + lead + body.length });
  }
  return out;
}

export const REQUIREMENT_RE = /\b(?:must|required|shall)\b/i;

export interface BlockRef {
  unit: Unit;
  text: string;
}

interface Req {
  key: string;
  ref: BlockRef;
  start: number;
  end: number;
}

function collect(blocks: readonly BlockRef[], renames: readonly Rename[], side: 'a' | 'b'): Req[] {
  const out: Req[] = [];
  for (const ref of blocks) {
    for (const r of sentenceRanges(ref.text)) {
      const s = ref.text.slice(r.start, r.end);
      if (!REQUIREMENT_RE.test(s)) continue;
      out.push({ key: renameNorm(s, renames, side), ref, start: r.start, end: r.end });
    }
  }
  return out;
}

/**
 * Must / required / shall sentences (B3) compared as multisets of rename-aware normalized text:
 * a sentence that only changed by an inferred rename is not reported. Removed first (old order),
 * then added (new order).
 */
export function diffRequirements(
  blocksA: readonly BlockRef[],
  blocksB: readonly BlockRef[],
  renames: readonly Rename[],
): RequirementDiff[] {
  const ra = collect(blocksA, renames, 'a');
  const rb = collect(blocksB, renames, 'b');
  const left = (xs: Req[], ys: Req[]) => {
    const pool = new Map<string, number>();
    for (const y of ys) pool.set(y.key, (pool.get(y.key) ?? 0) + 1);
    return xs.filter((x) => {
      const n = pool.get(x.key) ?? 0;
      if (n > 0) {
        pool.set(x.key, n - 1);
        return false;
      }
      return true;
    });
  };
  const row = (status: 'added' | 'removed', q: Req): RequirementDiff => ({
    status,
    path: q.ref.unit.path,
    excerpt: excerptOf(q.ref.text, q.start, q.end, 0),
  });
  return [
    ...left(ra, rb).map((q) => row('removed', q)),
    ...left(rb, ra).map((q) => row('added', q)),
  ];
}
