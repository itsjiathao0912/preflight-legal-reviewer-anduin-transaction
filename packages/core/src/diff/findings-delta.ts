import type { Finding } from '../findings/schema';
import type { Structure } from '../structure/types';
import type { Unit } from './align';
import { excerptOf } from './diff-text';
import { jaccard } from './normalize-key';
import type { DeltaRow, FindingsDelta } from './types';

/**
 * Findings delta (D4; replaces exact detector_id + quote_hash). Inside an aligned unit pair, a new
 * finding with the same detector_id whose normalized quote similarity is >= QUOTE_SIMILARITY is
 * "still present"; an old finding without a counterpart is "fixed" (its aligned unit no longer
 * triggers, or the unit was removed); a new finding without a counterpart is "new". Normalization:
 * case folded, punctuation and brackets stripped, digits masked to "#". Greedy best-first matching.
 * QUOTE_SIMILARITY is pinned from engine output on samples #5/#6 (see the Phase 07 report).
 */
export const QUOTE_SIMILARITY = 0.5;

export function quoteTokens(q: string): Set<string> {
  return new Set(
    q
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\d/g, '#')
      .replace(/[^\p{L}#]+/gu, ' ')
      .split(' ')
      .filter(Boolean),
  );
}

export function unitOfFinding(
  f: Finding,
  s: Structure,
  unitOfBlock: readonly number[],
): number | undefined {
  const bi = s.blocks.findIndex((b) => b.id === f.anchor.blockId);
  return bi >= 0 ? unitOfBlock[bi] : undefined;
}

export interface DeltaSide {
  findings: readonly Finding[];
  structure: Structure;
  unitOfBlock: readonly number[];
  units: readonly Unit[];
}

export function findingsDelta(
  A: DeltaSide,
  B: DeltaSide,
  partnerOfA: ReadonlyMap<number, number>,
): FindingsDelta {
  const ua = A.findings.map((f) => unitOfFinding(f, A.structure, A.unitOfBlock));
  const ub = B.findings.map((f) => unitOfFinding(f, B.structure, B.unitOfBlock));
  const ta = A.findings.map((f) => quoteTokens(f.quote));
  const tb = B.findings.map((f) => quoteTokens(f.quote));
  const cand: Array<[number, number, number]> = [];
  A.findings.forEach((fa, i) => {
    const pu = ua[i] === undefined ? undefined : partnerOfA.get(ua[i]!);
    if (pu === undefined) return;
    B.findings.forEach((fb, j) => {
      if (fb.detector_id !== fa.detector_id || ub[j] !== pu) return;
      const sim = jaccard(ta[i]!, tb[j]!);
      if (sim >= QUOTE_SIMILARITY) cand.push([sim, i, j]);
    });
  });
  cand.sort((x, y) => y[0] - x[0] || x[1] - y[1] || x[2] - y[2]);
  const mA = new Map<number, [number, number]>();
  const usedB = new Set<number>();
  for (const [sim, i, j] of cand) {
    if (mA.has(i) || usedB.has(j)) continue;
    mA.set(i, [j, sim]);
    usedB.add(j);
  }
  const base = (f: Finding) => ({
    detector_id: f.detector_id,
    issue_class: f.issue_class,
    severity: f.severity,
  });
  const pathOf = (side: DeltaSide, u: number | undefined) =>
    u === undefined ? undefined : side.units[u]!.path;
  const ex = (f: Finding) => excerptOf(f.quote, 0, f.quote.length, 0);
  const fixed: DeltaRow[] = [];
  const stillPresent: DeltaRow[] = [];
  const fresh: DeltaRow[] = [];
  A.findings.forEach((f, i) => {
    const m = mA.get(i);
    const pA = pathOf(A, ua[i]);
    if (!m) {
      fixed.push({ ...base(f), findingIdA: f.id, ...(pA ? { pathA: pA } : {}), excerpt: ex(f) });
      return;
    }
    const g = B.findings[m[0]]!;
    const pB = pathOf(B, ub[m[0]]);
    stillPresent.push({
      ...base(g),
      findingIdA: f.id,
      findingIdB: g.id,
      ...(pA ? { pathA: pA } : {}),
      ...(pB ? { pathB: pB } : {}),
      similarity: Math.round(m[1] * 1000) / 1000,
      excerpt: ex(g),
    });
  });
  B.findings.forEach((g, j) => {
    if (usedB.has(j)) return;
    const pB = pathOf(B, ub[j]);
    fresh.push({ ...base(g), findingIdB: g.id, ...(pB ? { pathB: pB } : {}), excerpt: ex(g) });
  });
  return { fixed, stillPresent, new: fresh };
}
