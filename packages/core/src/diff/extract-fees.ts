import { excerptOf } from './diff-text';
import type { BlockRef } from './extract-requirements';
import type { FeeDiff, FeeMention } from './types';

/** Percent mentions (B3): "3.5%", "0.85 %". Bounded, linear. */
const PERCENT_RE = /(?<![\d.])(\d{1,3}(?:\.\d{1,3})?)\s?%/g;

/** Class the fee applies to: "... for Class A" after the percent, else "Class A (0.85% ..." before it. */
function classOf(text: string, start: number, end: number): string | undefined {
  const after = text.slice(end, end + 80).split(/[;)]/)[0]!;
  const fa = /\bfor\s+Class\s+([A-Z]{1,2})\b/.exec(after);
  if (fa) return fa[1];
  const before = text.slice(Math.max(0, start - 40), start);
  const fb = /\bClass\s+([A-Z]{1,2})\b[^%]*$/.exec(before);
  return fb ? fb[1] : undefined;
}

export function feeMentions(blocks: readonly BlockRef[]): FeeMention[] {
  const out: FeeMention[] = [];
  for (const ref of blocks) {
    for (const m of ref.text.matchAll(PERCENT_RE)) {
      const start = m.index!;
      const end = start + m[0].length;
      const feeClass = classOf(ref.text, start, end);
      out.push({
        percent: `${m[1]}%`,
        ...(feeClass ? { feeClass } : {}),
        path: ref.unit.path,
        excerpt: excerptOf(ref.text, start, end, 70),
      });
    }
  }
  return out;
}

/**
 * Fee delta: pair by (percent, class) -> same; then by percent -> changed (class differs); then by
 * class -> changed (value differs); the rest are added / removed. Output: old order, then new.
 */
export function diffFees(a: readonly FeeMention[], b: readonly FeeMention[]): FeeDiff[] {
  const usedB = new Set<number>();
  const pairOf = new Map<number, [number, FeeDiff['status']]>();
  const pass = (eq: (x: FeeMention, y: FeeMention) => boolean, status: FeeDiff['status']) => {
    a.forEach((x, i) => {
      if (pairOf.has(i)) return;
      const j = b.findIndex((y, k) => !usedB.has(k) && eq(x, y));
      if (j >= 0) {
        usedB.add(j);
        pairOf.set(i, [j, status]);
      }
    });
  };
  pass((x, y) => x.percent === y.percent && x.feeClass === y.feeClass, 'same');
  pass((x, y) => x.percent === y.percent, 'changed');
  pass((x, y) => x.feeClass !== undefined && x.feeClass === y.feeClass, 'changed');
  const out: FeeDiff[] = [];
  a.forEach((x, i) => {
    const p = pairOf.get(i);
    out.push(p ? { status: p[1], a: x, b: b[p[0]]! } : { status: 'removed', a: x });
  });
  b.forEach((y, j) => {
    if (!usedB.has(j)) out.push({ status: 'added', b: y });
  });
  return out;
}
