import type { Unit } from './align';
import type { TokenDiffPart } from './diff-text';
import { excerptOf } from './diff-text';
import { foldPlural, foldTerm, normText } from './normalize-key';
import type { PossibleLeftover, Rename } from './types';

/**
 * Rename inference (D3) and the diff-only residual-term rule (AC16). No hardcoded pairs: a pair
 * (old -> new) is a rename when, in aligned text, the old term is replaced by the new term in the
 * same position (a removed run directly followed by an added run, both 1..MAX_WORDS words, with
 * unchanged text or the block edge on both sides) at least MIN_COUNT times, and those
 * substitutions cover at least MIN_COVERAGE of the old term's occurrences in the aligned old text.
 * Terms are compared case-folded with a last-word plural fold ("Units" and "Unit" are one term).
 */

export const MIN_COVERAGE = 0.8;
export const MIN_COUNT = 3;
const MAX_WORDS = 4;
/** Residual rule: share of the term's old sentences that also hold a renamed term. */
export const LEFTOVER_COOCCURRENCE = 0.5;
export const LEFTOVER_MIN_COUNT = 3;
export const LEFTOVER_MAX_CONFIDENCE = 0.4;

export interface AlignedText {
  a: Unit;
  b: Unit;
  parts: TokenDiffPart[] | undefined;
}

function phraseOf(toks: TokenDiffPart['a']): string | undefined {
  if (toks.some((t) => t.sensitive)) return undefined;
  const words = toks.filter((t) => !t.ws);
  if (words.length === 0 || words.length > MAX_WORDS) return undefined;
  if (!words.every((t) => /^[\p{L}][\p{L}'’-]*$/u.test(t.text))) return undefined;
  // a lone short lowercase word ("this" -> "the") is wording, not a term rename
  if (words.length === 1 && words[0]!.text.length <= 4 && /^\p{Ll}+$/u.test(words[0]!.text))
    return undefined;
  return toks
    .map((t) => (t.ws ? ' ' : t.text))
    .join('')
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-sensitive whole-phrase matcher for a plural-folded term (optional plural on the last word). */
export function termRegex(folded: string): RegExp {
  const words = folded.split(' ').map(escapeRe);
  const last = words.pop()!;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${[...words, `${last}s?`].join('\\s+')}(?![\\p{L}\\p{N}])`,
    'gu',
  );
}

function mostFrequent(forms: Map<string, number>): string {
  return [...forms.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]![0];
}

/** Map an old-text offset to the new-text offset at the same diff position. */
function mapOffset(parts: readonly TokenDiffPart[], aOff: number): number {
  let bPos = 0;
  for (const p of parts) {
    if (p.op === 'add') {
      for (const t of p.b) bPos = t.start + t.text.length;
      continue;
    }
    for (let k = 0; k < p.a.length; k++) {
      const t = p.a[k]!;
      if (aOff < t.start + t.text.length) return p.op === 'same' ? p.b[k]!.start : bPos;
      if (p.op === 'same') bPos = p.b[k]!.start + p.b[k]!.text.length;
    }
  }
  return bPos;
}

/** "Same position": the new term starts within this many chars of the mapped old offset. */
export const POSITION_WINDOW = 48;

/**
 * "Placement Fee" -> "Sales Load" diffs as two substitutions joined by an unchanged space; fold
 * del/add runs separated only by whitespace into one substitution so phrases stay whole.
 */
function mergeWsGaps(parts: readonly TokenDiffPart[]): TokenDiffPart[] {
  const out: TokenDiffPart[] = [];
  let k = 0;
  while (k < parts.length) {
    const p = parts[k]!;
    if (p.op === 'del' && parts[k + 1]?.op === 'add') {
      const del: TokenDiffPart = { op: 'del', a: [...p.a], b: [] };
      const add: TokenDiffPart = { op: 'add', a: [], b: [...parts[k + 1]!.b] };
      k += 2;
      while (
        parts[k]?.op === 'same' &&
        parts[k]!.a.every((t) => t.ws) &&
        parts[k + 1]?.op === 'del' &&
        parts[k + 2]?.op === 'add'
      ) {
        del.a.push(...parts[k]!.a, ...parts[k + 1]!.a);
        add.b.push(...parts[k]!.b, ...parts[k + 2]!.b);
        k += 3;
      }
      out.push(del, add);
      continue;
    }
    out.push(p);
    k++;
  }
  return out;
}

export function inferRenames(aligned: readonly AlignedText[]): Rename[] {
  interface Acc {
    from: Map<string, number>;
    to: Map<string, number>;
    ff: string;
    ft: string;
  }
  const acc = new Map<string, Acc>();
  for (const { parts: raw } of aligned) {
    if (!raw) continue;
    const parts = mergeWsGaps(raw);
    for (let k = 0; k + 1 < parts.length; k++) {
      const del = parts[k]!;
      const add = parts[k + 1]!;
      if (del.op !== 'del' || add.op !== 'add') continue;
      const before = parts[k - 1];
      const after = parts[k + 2];
      if ((before && before.op !== 'same') || (after && after.op !== 'same')) continue;
      const from = phraseOf(del.a);
      const to = phraseOf(add.b);
      if (!from || !to) continue;
      const ff = foldPlural(from);
      const ft = foldPlural(to);
      if (!ff || !ft || foldTerm(ff) === foldTerm(ft)) continue;
      const key = `${ff}\u0000${ft}`;
      const e = acc.get(key) ?? { from: new Map(), to: new Map(), ff, ft };
      e.from.set(from, (e.from.get(from) ?? 0) + 1);
      e.to.set(to, (e.to.get(to) ?? 0) + 1);
      acc.set(key, e);
    }
  }
  const out: Rename[] = [];
  for (const e of [...acc.values()].sort((x, y) => (x.ff + x.ft < y.ff + y.ft ? -1 : 1))) {
    // coverage: old occurrences whose aligned new position holds the new term
    const reFrom = termRegex(e.ff);
    const reTo = termRegex(e.ft);
    let occurrences = 0;
    let count = 0;
    for (const { a, b, parts } of aligned) {
      if (!parts) continue;
      for (const m of a.text.matchAll(reFrom)) {
        occurrences++;
        const at = mapOffset(parts, m.index!);
        const win = b.text.slice(
          Math.max(0, at - POSITION_WINDOW),
          at + POSITION_WINDOW + e.ft.length,
        );
        reTo.lastIndex = 0;
        if (reTo.test(win)) count++;
      }
    }
    if (count < MIN_COUNT || occurrences === 0) continue;
    const coverage = count / occurrences;
    if (coverage < MIN_COVERAGE) continue;
    out.push({
      from: mostFrequent(e.from),
      to: mostFrequent(e.to),
      count,
      occurrences,
      confidence: Math.round(Math.min(0.95, coverage) * 100) / 100,
    });
  }
  // one old term maps to one new term: keep the strongest
  const best = new Map<string, Rename>();
  for (const r of out.sort(
    (x, y) =>
      y.count - x.count || (x.from < y.from ? -1 : x.from > y.from ? 1 : x.to < y.to ? -1 : 1),
  )) {
    const k = foldPlural(r.from);
    if (!best.has(k)) best.set(k, r);
  }
  // a shorter old phrase inside a longer accepted one with the same new term is the same rename
  // ("placement" inside "placement agent" -> "distributor"): keep the longer phrase
  const kept = [...best.values()];
  const within = (inner: string, outer: string) =>
    inner !== outer && termRegex(foldPlural(inner)).test(outer);
  return kept
    .filter(
      (r) =>
        !kept.some(
          (o) => o !== r && foldPlural(o.to) === foldPlural(r.to) && within(r.from, o.from),
        ),
    )
    .sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0));
}

const SENTENCE_SPLIT = /(?<=[.;:])\s+|\n/;

/**
 * Residual legacy term (diff-only, never a Finding): an old-document defined term that is not
 * itself renamed, whose old sentences hold a renamed term at least LEFTOVER_COOCCURRENCE of the
 * time, and that still appears at least LEFTOVER_MIN_COUNT times in the new document. Reported as
 * "Possible leftover", severity low, confidence <= 0.4.
 */
export function possibleLeftovers(
  oldTerms: readonly string[],
  renames: readonly Rename[],
  unitsA: readonly Unit[],
  unitsB: readonly Unit[],
): PossibleLeftover[] {
  if (renames.length === 0) return [];
  const renamedFolds = new Set(renames.flatMap((r) => [foldTerm(r.from), foldTerm(r.to)]));
  const fromRes = renames.map((r) => ({ name: r.from, re: termRegex(foldPlural(r.from)) }));
  const sentences = unitsA.flatMap((u) => u.text.split(SENTENCE_SPLIT)).filter(Boolean);
  const out: PossibleLeftover[] = [];
  const seen = new Set<string>();
  for (const term of oldTerms) {
    const fold = foldTerm(term);
    if (!fold || seen.has(fold) || renamedFolds.has(fold)) continue;
    seen.add(fold);
    // the term must not merely contain or be contained in a renamed term
    if ([...renamedFolds].some((r) => normText(r).includes(fold) || fold.includes(normText(r))))
      continue;
    const exact = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, 'gu');
    let withTerm = 0;
    let withRenamed = 0;
    const co = new Set<string>();
    for (const s of sentences) {
      exact.lastIndex = 0;
      if (!exact.test(s)) continue;
      withTerm++;
      let hit = false;
      for (const f of fromRes) {
        f.re.lastIndex = 0;
        if (f.re.test(s)) {
          hit = true;
          co.add(f.name);
        }
      }
      if (hit) withRenamed++;
    }
    if (withTerm === 0) continue;
    const ratio = withRenamed / withTerm;
    if (ratio < LEFTOVER_COOCCURRENCE) continue;
    let countB = 0;
    let firstB: { u: Unit; at: number } | undefined;
    for (const u of unitsB) {
      exact.lastIndex = 0;
      for (const m of u.text.matchAll(exact)) {
        if (!firstB) firstB = { u, at: m.index! };
        countB++;
      }
    }
    if (countB < LEFTOVER_MIN_COUNT) continue;
    out.push({
      term,
      label: 'Possible leftover',
      severity: 'low',
      confidence:
        Math.round(Math.min(LEFTOVER_MAX_CONFIDENCE, LEFTOVER_MAX_CONFIDENCE * ratio) * 100) / 100,
      countB,
      cooccursWith: [...co].sort(),
      ...(firstB ? { b: excerptOf(firstB.u.text, firstB.at, firstB.at + term.length) } : {}),
    });
  }
  return out.sort((x, y) => (x.term < y.term ? -1 : x.term > y.term ? 1 : 0));
}

/**
 * Rename-aware normalized text: old-side occurrences of `from` and new-side occurrences of `to`
 * become the same placeholder word, so a sentence that only changed by a rename compares equal.
 */
export function renameNorm(text: string, renames: readonly Rename[], side: 'a' | 'b'): string {
  let t = text;
  renames.forEach((r, i) => {
    t = t.replace(termRegex(foldPlural(side === 'a' ? r.from : r.to)), ` renamedterm${i} `);
  });
  return normText(t);
}
