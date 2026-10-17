import { useMemo } from 'react';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import {
  buildRows,
  chipCounts,
  computeGate,
  hasNoText,
  counselCount,
  openCount,
  placement,
  visibleRows,
} from './model';

/** Derived review view shared by the Findings screen, sidebar badges and the gate. */
export function useReviewView() {
  const result = useReview((s) => s.result);
  const memory = useReview((s) => s.memory);
  const triage = useReview((s) => s.triage);
  const sev = useFilters((s) => s.sev);
  const cls = useFilters((s) => s.cls);
  const status = useFilters((s) => s.status);
  const sort = useFilters((s) => s.sort);
  const det = useFilters((s) => s.det);
  return useMemo(() => {
    const rows = buildRows(result?.findings ?? [], memory, triage);
    const { main, previous } = placement(rows);
    const visible = visibleRows(main, { sev, cls, status, sort, det });
    return {
      rows,
      main,
      previous,
      visible,
      chips: chipCounts(main),
      open: openCount(main),
      counsel: counselCount(rows),
      // a document with no readable text was never checked: the gate reads `unreadable`, never Ready
      gate: { ...computeGate(rows), unreadable: hasNoText(result) },
    };
  }, [result, memory, triage, sev, cls, status, sort, det]);
}
