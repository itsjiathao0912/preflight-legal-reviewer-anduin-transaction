import type { FindingView } from '../../../engine/types';
import type { Triage } from '../model';

export interface DedupeResult {
  findings: FindingView[];
  /** primaryId -> AI twin */
  twins: Record<string, FindingView>;
  /** twinId -> primaryId */
  twinOf: Record<string, string>;
}

/** Overlap length of half-open ranges [start, end); 0 when they only touch or are disjoint. */
function overlap(a: FindingView, b: FindingView): number {
  const lo = Math.max(a.anchor.offsetStart, b.anchor.offsetStart);
  const hi = Math.min(a.anchor.offsetEnd, b.anchor.offsetEnd);
  return hi > lo ? hi - lo : 0;
}

const isChange = (f: FindingView): boolean => f.kind === 'change';

/**
 * Merges an AI finding into the rule finding it duplicates. Rules claim in input order (E11):
 * each takes the still-unused AI finding with the largest overlap on the same block and issue
 * class (tie: lowest `order`, then lowest id). The rule keeps its id and severity; unmatched AI
 * findings stay separate rows. Change rows are never merged.
 */
export function dedupeFindings(findings: readonly FindingView[]): DedupeResult {
  const used = new Set<string>();
  const twins: Record<string, FindingView> = {};
  const twinOf: Record<string, string> = {};
  const ais = findings.filter((f) => f.detector_kind === 'ai' && !isChange(f));
  for (const rule of findings) {
    if (rule.detector_kind !== 'rule' || isChange(rule)) continue;
    let best: FindingView | null = null;
    let bestOv = 0;
    for (const ai of ais) {
      if (used.has(ai.id)) continue;
      if (ai.anchor.blockId !== rule.anchor.blockId || ai.issue_class !== rule.issue_class)
        continue;
      const ov = overlap(rule, ai);
      if (ov === 0) continue;
      if (
        best === null ||
        ov > bestOv ||
        (ov === bestOv && (ai.order < best.order || (ai.order === best.order && ai.id < best.id)))
      ) {
        best = ai;
        bestOv = ov;
      }
    }
    if (best) {
      used.add(best.id);
      twins[rule.id] = best;
      twinOf[best.id] = rule.id;
    }
  }
  return { findings: findings.filter((f) => !used.has(f.id)), twins, twinOf };
}

/** Primary falls back to the twin's triage when it has none; never invents keys. */
export function triageWithTwins(
  triage: Readonly<Record<string, Triage>>,
  twinOf: Readonly<Record<string, string>>,
): Record<string, Triage> {
  const out: Record<string, Triage> = { ...triage };
  for (const [twinId, primaryId] of Object.entries(twinOf)) {
    const t = triage[twinId];
    if (t && !(primaryId in triage)) out[primaryId] = t;
  }
  return out;
}
