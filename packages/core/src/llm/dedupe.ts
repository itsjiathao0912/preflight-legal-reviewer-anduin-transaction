/**
 * AI-vs-rule duplicate removal (pure). An AI finding whose anchor overlaps a deterministic
 * (`detector_kind === 'rule'`) finding's anchor in the same block repeats what the rule engine
 * already reported, so it is dropped. Any issue class counts. AI findings never drop each other.
 */

interface AnchorLike {
  blockId: string;
  offsetStart: number;
  offsetEnd: number;
}

/**
 * Half-open overlap of `[aStart, aEnd)` and `[bStart, bEnd)`. Zero-length ranges are normalized
 * to one character (`end = max(end, start + 1)`). Adjacent ranges do not overlap. Non-finite
 * offsets never overlap (hostile input is treated as "no overlap", never a throw).
 */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  if (![aStart, aEnd, bStart, bEnd].every((n) => Number.isFinite(n))) return false;
  const ae = Math.max(aEnd, aStart + 1);
  const be = Math.max(bEnd, bStart + 1);
  return aStart < be && bStart < ae;
}

/** Split `ai` into findings kept and findings that duplicate a rule anchor in the same block. */
export function dropRuleDuplicates<T extends { anchor: AnchorLike }>(
  ai: readonly T[],
  rules: readonly { detector_kind: string; anchor: AnchorLike }[],
): { kept: T[]; dropped: T[] } {
  const byBlock = new Map<string, AnchorLike[]>();
  for (const r of rules) {
    if (r.detector_kind !== 'rule') continue;
    const list = byBlock.get(r.anchor.blockId);
    if (list) list.push(r.anchor);
    else byBlock.set(r.anchor.blockId, [r.anchor]);
  }
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const f of ai) {
    const spans = byBlock.get(f.anchor.blockId);
    const dup =
      spans?.some((r) =>
        rangesOverlap(f.anchor.offsetStart, f.anchor.offsetEnd, r.offsetStart, r.offsetEnd),
      ) ?? false;
    (dup ? dropped : kept).push(f);
  }
  return { kept, dropped };
}
