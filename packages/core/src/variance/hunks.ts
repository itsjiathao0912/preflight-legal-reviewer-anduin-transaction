import type { Alignment, Unit } from '../diff/align';
import { diffText, type Token, type TokenDiffPart } from '../diff/diff-text';
import type { AlignedText } from '../diff/rename-inference';
import type { Hunk } from './types';

/**
 * The hunker (DECISION D1 raw change). For each aligned unit pair the FULL unit text of both
 * structures is diffed word by word (never the clipped `DiffResult.segments`); maximal runs of
 * non-same tokens become hunks, and two runs separated by at most `mergeGap` same tokens merge.
 * A wholly added / removed unit gives one hunk per block. A diff that hits the edit bound maps to
 * one coarse replace hunk flagged `truncated` (never a throw). A moved unit with identical text
 * gives one `move` hunk. Output order: new-document order, removed units before the first pair
 * after them (the `diffDocuments` section order).
 */

export interface HunkOptions {
  mergeGap: number;
  maxEditLength: number;
}

export interface UnitPair {
  a: Unit;
  b: Unit;
  outOfOrder: boolean;
}

export interface HunkSet {
  hunks: Hunk[];
  /** Aligned text pairs (for `inferRenames`). */
  aligned: AlignedText[];
  pairs: UnitPair[];
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
const joinText = (toks: readonly Token[]) => collapse(toks.map((t) => t.text).join(''));

interface Run {
  a: Token[];
  b: Token[];
  changedA: Token[];
  changedB: Token[];
  aStart: number;
  bStart: number;
}

function hunksOfParts(
  parts: readonly TokenDiffPart[],
  mergeGap: number,
): Array<Omit<Hunk, 'index' | 'unitKeyA' | 'unitKeyB' | 'truncated'>> {
  const runs: Run[] = [];
  let cur: Run | undefined;
  let pending: TokenDiffPart | undefined;
  let posA = 0;
  let posB = 0;
  for (const p of parts) {
    if (p.op === 'same') {
      if (cur) pending = p;
      posA = p.a.length ? p.a.at(-1)!.start + p.a.at(-1)!.text.length : posA;
      posB = p.b.length ? p.b.at(-1)!.start + p.b.at(-1)!.text.length : posB;
      continue;
    }
    if (cur && pending && pending.a.length <= mergeGap) {
      cur.a.push(...pending.a);
      cur.b.push(...pending.b);
    } else if (cur && pending) {
      runs.push(cur);
      cur = undefined;
    }
    pending = undefined;
    cur ??= { a: [], b: [], changedA: [], changedB: [], aStart: posA, bStart: posB };
    if (p.op === 'del') {
      cur.a.push(...p.a);
      cur.changedA.push(...p.a);
      if (p.a.length) posA = p.a.at(-1)!.start + p.a.at(-1)!.text.length;
    } else {
      cur.b.push(...p.b);
      cur.changedB.push(...p.b);
      if (p.b.length) posB = p.b.at(-1)!.start + p.b.at(-1)!.text.length;
    }
  }
  if (cur) runs.push(cur);

  const out: Array<Omit<Hunk, 'index' | 'unitKeyA' | 'unitKeyB' | 'truncated'>> = [];
  for (const r of runs) {
    const oldTokens = r.changedA.filter((t) => !t.ws).map((t) => t.text);
    const newTokens = r.changedB.filter((t) => !t.ws).map((t) => t.text);
    // a whitespace-only difference is not a change
    if (oldTokens.length === 0 && newTokens.length === 0) continue;
    const span = (toks: Token[], start: number) => {
      const words = toks.filter((t) => !t.ws);
      if (!words.length) return [start, start] as const;
      return [words[0]!.start, words.at(-1)!.start + words.at(-1)!.text.length] as const;
    };
    const [oldStart, oldEnd] = span(r.a, r.aStart);
    const [newStart, newEnd] = span(r.b, r.bStart);
    out.push({
      kind: oldTokens.length === 0 ? 'insert' : newTokens.length === 0 ? 'delete' : 'replace',
      oldTokens,
      newTokens,
      oldText: joinText(r.a),
      newText: joinText(r.b),
      oldStart,
      oldEnd,
      newStart,
      newEnd,
    });
  }
  return out;
}

function blockSpans(u: Unit): Array<{ start: number; end: number; text: string }> {
  // unit text = block texts joined by '\n' (buildUnits)
  const out: Array<{ start: number; end: number; text: string }> = [];
  let pos = 0;
  for (const line of u.text.split('\n')) {
    out.push({ start: pos, end: pos + line.length, text: line });
    pos += line.length + 1;
  }
  return out;
}

function wholeUnitHunks(u: Unit, side: 'added' | 'removed'): Array<Omit<Hunk, 'index'>> {
  const out: Array<Omit<Hunk, 'index'>> = [];
  for (const b of blockSpans(u)) {
    const text = collapse(b.text);
    if (!text) continue;
    const words = text.split(' ');
    out.push(
      side === 'added'
        ? {
            unitKeyB: u.key,
            kind: 'insert',
            whole: 'added',
            oldTokens: [],
            newTokens: words,
            oldText: '',
            newText: text,
            oldStart: 0,
            oldEnd: 0,
            newStart: b.start,
            newEnd: b.end,
            truncated: false,
          }
        : {
            unitKeyA: u.key,
            kind: 'delete',
            whole: 'removed',
            oldTokens: words,
            newTokens: [],
            oldText: text,
            newText: '',
            oldStart: b.start,
            oldEnd: b.end,
            newStart: 0,
            newEnd: 0,
            truncated: false,
          },
    );
  }
  return out;
}

export function buildHunks(
  A: readonly Unit[],
  B: readonly Unit[],
  al: Alignment,
  opts: HunkOptions,
): HunkSet {
  const hunks: Hunk[] = [];
  const aligned: AlignedText[] = [];
  const pairs: UnitPair[] = [];
  const push = (h: Omit<Hunk, 'index'>) => hunks.push({ index: hunks.length, ...h });

  const pairOf = (ia: number, ib: number) => {
    const a = A[ia]!;
    const b = B[ib]!;
    const outOfOrder = al.outOfOrder.has(ia);
    pairs.push({ a, b, outOfOrder });
    if (a.text === b.text) {
      aligned.push({ a, b, parts: [] });
      if (outOfOrder)
        push({
          unitKeyA: a.key,
          unitKeyB: b.key,
          kind: 'move',
          oldTokens: [],
          newTokens: [],
          oldText: collapse(a.title),
          newText: collapse(b.title),
          oldStart: 0,
          oldEnd: 0,
          newStart: 0,
          newEnd: 0,
          truncated: false,
        });
      return;
    }
    const d = diffText(a.text, b.text, opts.maxEditLength);
    aligned.push({ a, b, parts: d.parts });
    if (!d.parts) {
      push({
        unitKeyA: a.key,
        unitKeyB: b.key,
        kind: 'replace',
        oldTokens: a.text.split(/\s+/).filter(Boolean),
        newTokens: b.text.split(/\s+/).filter(Boolean),
        oldText: collapse(a.text),
        newText: collapse(b.text),
        oldStart: 0,
        oldEnd: a.text.length,
        newStart: 0,
        newEnd: b.text.length,
        truncated: true,
      });
      return;
    }
    for (const h of hunksOfParts(d.parts, opts.mergeGap))
      push({ ...h, unitKeyA: a.key, unitKeyB: b.key, truncated: false });
  };

  const pendingA = [...al.onlyA];
  const partnerOfB = new Map(al.pairs.map(([ia, ib]) => [ib, ia] as const));
  B.forEach((ub, ib) => {
    const ia = partnerOfB.get(ib);
    if (ia === undefined) {
      for (const h of wholeUnitHunks(ub, 'added')) push(h);
      return;
    }
    while (pendingA.length && pendingA[0]! < ia)
      for (const h of wholeUnitHunks(A[pendingA.shift()!]!, 'removed')) push(h);
    pairOf(ia, ib);
  });
  for (const ia of pendingA) for (const h of wholeUnitHunks(A[ia]!, 'removed')) push(h);
  return { hunks, aligned, pairs };
}
