import type { Structure } from '../structure/types';
import type { UnitKind } from './types';
import { jaccard, normText, numbering, scopeLabel, titleKey, tokenSet } from './normalize-key';

/**
 * Alignment units and the D2 aligner. A unit is a scope preamble, a section (up to its first part)
 * or a part. Passes: exact key (structural key + heading key) -> LCS on heading keys inside the
 * unmatched windows -> same structural key (relabel) -> bounded similarity fallback (token Jaccard
 * on heading + first SIM_PREFIX chars) inside the still-unmatched windows. Exact anchors are made
 * monotone with a longest-increasing-subsequence pass (O(n log n)); the k^2 passes only run inside
 * the windows between anchors, so the cost is O(n log n + sum k^2).
 */

export interface Unit {
  index: number;
  kind: UnitKind;
  /** Structural key: scope kind + label/occurrence, section number, part letter (+ #ordinal). */
  key: string;
  /** Normalized heading (parentheticals dropped). */
  headKey: string;
  title: string;
  path: string[];
  blockIndices: number[];
  text: string;
  /** Normalized text, for "same" checks. */
  norm: string;
  /** Canonical ordinal of the numbering label (tie-break for Roman / letter labels). */
  ordinal: number;
}

export function blockText(s: Structure, i: number): string {
  return s.blocks[i]!.lines.map((l) => l.text).join(' ');
}

const MAX_PATH_PART = 300;
const clipPath = (p: string) => (p.length > MAX_PATH_PART ? p.slice(0, MAX_PATH_PART) : p);

/** Build the ordered alignment units of one document (pure). */
export function buildUnits(s: Structure): Unit[] {
  const units: Unit[] = [];
  const kindCount = new Map<string, number>();
  const scopeKeys = new Map<string, string>();
  let cur: Unit | undefined;
  let curId = '';

  for (let i = 0; i < s.blocks.length; i++) {
    const info = s.info[i];
    if (!info) continue;
    const scope = info.scope;
    let scopeKey = scopeKeys.get(scope.id);
    if (!scopeKey) {
      const label = scopeLabel(scope.title);
      const n = (kindCount.get(scope.kind) ?? 0) + 1;
      kindCount.set(scope.kind, n);
      scopeKey = `${scope.kind}:${label ?? n}`;
      scopeKeys.set(scope.id, scopeKey);
    }
    const sec = info.section;
    const part = sec && info.part ? info.part : undefined;
    const id = `${scope.id}|${sec ? `${sec.number}@${sec.blockIndex}` : ''}|${part ? `${part.letter}@${part.blockIndex}` : ''}`;
    if (!cur || id !== curId) {
      const scopeTitle = clipPath(scope.title);
      let kind: UnitKind = 'scope';
      let key = scopeKey;
      let title = scope.title;
      const path = [scopeTitle];
      let ordinal = numbering(scopeLabel(scope.title)).ordinal;
      if (sec) {
        kind = 'section';
        key += `/s${sec.number.toLowerCase()}`;
        title = sec.title;
        path.push(clipPath(`${sec.number}. ${sec.title}`));
        ordinal = numbering(sec.number).ordinal;
        if (part) {
          kind = 'part';
          key += `/p${part.letter.toLowerCase()}`;
          title = part.label;
          path.push(clipPath(`Part ${part.letter} – ${part.label}`));
          ordinal = numbering(part.letter).ordinal;
        }
      }
      cur = {
        index: units.length,
        kind,
        key,
        headKey: titleKey(title),
        title: clipPath(title),
        path,
        blockIndices: [],
        text: '',
        norm: '',
        ordinal,
      };
      curId = id;
      units.push(cur);
    }
    cur.blockIndices.push(i);
  }
  // repeated keys (running headers, duplicated headings) get an ordinal and align in sequence
  const seen = new Map<string, number>();
  for (const u of units) {
    const n = (seen.get(u.key) ?? 0) + 1;
    seen.set(u.key, n);
    if (n > 1) u.key += `#${n}`;
    u.text = u.blockIndices.map((bi) => blockText(s, bi)).join('\n');
    u.norm = normText(u.text);
  }
  return units;
}

/** Units that carry a real heading (not the untitled document preamble). */
export function headedUnitCount(units: readonly Unit[]): number {
  return units.filter((u) => u.kind !== 'scope' || !u.key.startsWith('body:')).length;
}

export interface Alignment {
  /** Matched pairs [aIndex, bIndex], in B order. */
  pairs: Array<[number, number]>;
  /** For a matched pair: true when its exact anchor broke monotone order. */
  outOfOrder: Set<number>;
  onlyA: number[];
  onlyB: number[];
  stats: {
    exact: number;
    lcs: number;
    relabel: number;
    similar: number;
    lcsCells: number;
    simPairs: number;
  };
}

export const SIM_PREFIX = 200;
export const SIM_THRESHOLD = 0.5;
/** Bound on the k^2 passes per window (cells); larger windows skip to unmatched lists. */
export const MAX_WINDOW_CELLS = 250_000;

/** Longest increasing subsequence over pair b-indices (pairs sorted by a). Returns kept positions. */
function lisKeep(bs: number[]): Set<number> {
  const tails: number[] = [];
  const tailIdx: number[] = [];
  const prev = new Array<number>(bs.length).fill(-1);
  for (let i = 0; i < bs.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid]! < bs[i]!) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = bs[i]!;
    tailIdx[lo] = i;
    prev[i] = lo > 0 ? tailIdx[lo - 1]! : -1;
  }
  const keep = new Set<number>();
  let k = tails.length ? tailIdx[tails.length - 1]! : -1;
  while (k >= 0) {
    keep.add(k);
    k = prev[k]!;
  }
  return keep;
}

export function alignUnits(A: readonly Unit[], B: readonly Unit[]): Alignment {
  const matchA = new Array<number>(A.length).fill(-1);
  const matchB = new Array<number>(B.length).fill(-1);
  const stats = { exact: 0, lcs: 0, relabel: 0, similar: 0, lcsCells: 0, simPairs: 0 };
  const outOfOrderA = new Set<number>();

  // pass 1: exact (structural key + heading key)
  const byKey = new Map<string, number>();
  B.forEach((u, j) => byKey.set(`${u.key}\u0000${u.headKey}`, j));
  const exact: Array<[number, number]> = [];
  A.forEach((u, i) => {
    const j = byKey.get(`${u.key}\u0000${u.headKey}`);
    if (j !== undefined) exact.push([i, j]);
  });
  const keep = lisKeep(exact.map((p) => p[1]));
  exact.forEach(([i, j], k) => {
    matchA[i] = j;
    matchB[j] = i;
    stats.exact++;
    if (!keep.has(k)) outOfOrderA.add(i);
  });

  // windows between monotone anchors
  const windows = (): Array<[number, number, number, number]> => {
    const anchors = exact.filter((_, k) => keep.has(k));
    const out: Array<[number, number, number, number]> = [];
    let pa = 0;
    let pb = 0;
    for (const [i, j] of [...anchors, [A.length, B.length] as [number, number]]) {
      if (i > pa && j > pb) out.push([pa, i, pb, j]);
      pa = i + 1;
      pb = j + 1;
    }
    return out;
  };
  const free = (lo: number, hi: number, m: number[]) => {
    const r: number[] = [];
    for (let x = lo; x < hi; x++) if (m[x] === -1) r.push(x);
    return r;
  };

  for (const [a0, a1, b0, b1] of windows()) {
    // pass 2: LCS on heading keys (renumbered / restructured sections)
    let fa = free(a0, a1, matchA);
    let fb = free(b0, b1, matchB);
    if (fa.length && fb.length && fa.length * fb.length <= MAX_WINDOW_CELLS) {
      const n = fa.length;
      const m = fb.length;
      const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
      for (let x = n - 1; x >= 0; x--)
        for (let y = m - 1; y >= 0; y--) {
          stats.lcsCells++;
          dp[x]![y] =
            A[fa[x]!]!.headKey !== '' && A[fa[x]!]!.headKey === B[fb[y]!]!.headKey
              ? dp[x + 1]![y + 1]! + 1
              : Math.max(dp[x + 1]![y]!, dp[x]![y + 1]!);
        }
      let x = 0;
      let y = 0;
      while (x < n && y < m) {
        const ua = A[fa[x]!]!;
        const ub = B[fb[y]!]!;
        if (ua.headKey !== '' && ua.headKey === ub.headKey && ua.kind === ub.kind) {
          matchA[ua.index] = ub.index;
          matchB[ub.index] = ua.index;
          stats.lcs++;
          x++;
          y++;
        } else if (dp[x + 1]![y]! >= dp[x]![y + 1]!) x++;
        else y++;
      }
    }
    // pass 3: same structural key, different heading (relabel)
    fa = free(a0, a1, matchA);
    fb = free(b0, b1, matchB);
    const fbByKey = new Map(fb.map((j) => [B[j]!.key, j] as const));
    for (const i of fa) {
      const j = fbByKey.get(A[i]!.key);
      if (j !== undefined && matchB[j] === -1) {
        matchA[i] = j;
        matchB[j] = i;
        stats.relabel++;
      }
    }
    // pass 4: bounded similarity fallback, greedy best-first (ties: lower a, then lower b,
    // then closer canonical ordinal)
    fa = free(a0, a1, matchA);
    fb = free(b0, b1, matchB);
    if (fa.length && fb.length && fa.length * fb.length <= MAX_WINDOW_CELLS) {
      const sig = (u: Unit) => tokenSet(`${u.title} ${u.text.slice(0, SIM_PREFIX)}`);
      const sa = fa.map((i) => sig(A[i]!));
      const sb = fb.map((j) => sig(B[j]!));
      const cand: Array<[number, number, number, number]> = [];
      fa.forEach((i, x) =>
        fb.forEach((j, y) => {
          stats.simPairs++;
          if (A[i]!.kind !== B[j]!.kind) return;
          const sim = jaccard(sa[x]!, sb[y]!);
          if (sim >= SIM_THRESHOLD) cand.push([sim, i, j, Math.abs(A[i]!.ordinal - B[j]!.ordinal)]);
        }),
      );
      cand.sort((p, q) => q[0] - p[0] || p[1] - q[1] || p[3] - q[3] || p[2] - q[2]);
      for (const [, i, j] of cand) {
        if (matchA[i] !== -1 || matchB[j] !== -1) continue;
        matchA[i] = j;
        matchB[j] = i;
        stats.similar++;
      }
    }
  }

  const pairs: Array<[number, number]> = [];
  const outOfOrder = new Set<number>();
  B.forEach((_, j) => {
    if (matchB[j] !== -1) {
      pairs.push([matchB[j]!, j]);
      if (outOfOrderA.has(matchB[j]!)) outOfOrder.add(matchB[j]!);
    }
  });
  return {
    pairs,
    outOfOrder,
    onlyA: A.map((_, i) => i).filter((i) => matchA[i] === -1),
    onlyB: B.map((_, j) => j).filter((j) => matchB[j] === -1),
    stats,
  };
}
