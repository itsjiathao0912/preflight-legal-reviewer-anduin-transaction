import { useMemo } from 'react';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import { changeFindings, mergeFindings, reviewCounts, reviewGate } from '../variance/select';
import { isPending, useVariance } from '../variance/variance-store';
import { buildRows, placement, visibleRows } from './model';

/** Derived review view shared by the Findings screen, sidebar badges and the gate. */
export function useReviewView() {
  const result = useReview((s) => s.result);
  const memory = useReview((s) => s.memory);
  const triage = useReview((s) => s.triage);
  const docId = useReview((s) => s.doc?.id ?? null);
  const sev = useFilters((s) => s.sev);
  const cls = useFilters((s) => s.cls);
  const status = useFilters((s) => s.status);
  const sort = useFilters((s) => s.sort);
  const det = useFilters((s) => s.det);
  const kind = useFilters((s) => s.kind);
  const showCosmetic = useFilters((s) => s.showCosmetic);
  const vStatus = useVariance((s) => s.status);
  const vResult = useVariance((s) => s.result);
  const vDoc = useVariance((s) => s.docId);
  const vReg = useVariance((s) => s.regression);
  return useMemo(() => {
    // Variance P02: change rows join only when the pass for THIS document is ready
    const ready = vStatus === 'ready' && vResult !== null && vDoc === docId;
    // Variance P04: regression findings of this document join with or without a baseline
    const changes = changeFindings(ready ? vResult.findings : null, vReg, docId);
    const policy = ready ? vResult.gatePolicy : undefined;
    const rows = buildRows(mergeFindings(result?.findings ?? [], changes), memory, triage);
    const { main, previous } = placement(rows);
    const visible = visibleRows(main, { sev, cls, status, sort, det, kind, showCosmetic });
    // a document with no readable text was never checked: the gate reads `unreadable`, never Ready
    const gate = reviewGate(rows, result, policy);
    const counts = reviewCounts(rows, main, gate);
    return {
      rows,
      main,
      previous,
      visible,
      chips: counts.chips,
      open: counts.open,
      counsel: counts.counsel,
      counts,
      hasChanges: changes.length > 0,
      regressionMeta: vReg && vReg.docId === docId ? vReg.meta : {},
      variance: ready ? vResult : null,
      variancePending: isPending({ status: vStatus }) && vDoc === docId,
      gate,
    };
  }, [
    result,
    memory,
    triage,
    docId,
    sev,
    cls,
    status,
    sort,
    det,
    kind,
    showCosmetic,
    vStatus,
    vResult,
    vDoc,
    vReg,
  ]);
}
