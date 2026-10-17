import { GATE_REASON_TEXT, type GateReason } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { useCounsel } from '../counsel/counsel-store';
import { isQuestion } from '../counsel/sheet-model';
import { memoryLabelText } from '../review/memory-labels';
import type { Row } from '../review/model';

/**
 * Gate popover reasons (AC22). Each reason links to where it is resolved: a counsel question or an
 * Awaiting-counsel item opens it in Counsel questions; anything else selects the finding. A
 * `reconfirm_required` item shows "Dismissed in [fund], re-confirm": re-confirm it by dismissing it
 * again with a reason in Findings, or by a clear counsel answer (D-2).
 */
export function reasonTarget(r: GateReason, row: Row | undefined): 'counsel' | 'findings' {
  if (!row) return 'findings';
  if (isQuestion(row) || r.kind === 'awaiting_counsel' || r.kind === 'unclear') return 'counsel';
  return 'findings';
}

export function reasonText(r: GateReason, row: Row | undefined): string {
  if (r.kind === 'reconfirm_required')
    return `${memoryLabelText('dismissed_reconfirm', row?.prior?.fund_name)}`;
  if (r.kind === 'awaiting_counsel' && row?.status === 'open' && row.prior?.fund_name)
    return `Awaiting counsel (asked in ${row.prior.fund_name})`;
  return GATE_REASON_TEXT[r.kind];
}

export function GateReasons({
  reasons,
  rows,
  onGo,
}: {
  reasons: readonly GateReason[];
  rows: readonly Row[];
  onGo: () => void;
}) {
  const select = useReview((s) => s.select);
  const setRoute = useShell((s) => s.setRoute);
  const reset = useFilters((s) => s.reset);
  const focusItem = useCounsel((s) => s.focusItem);
  const byId = new Map(rows.map((r) => [r.f.id, r]));
  return (
    <ul>
      {reasons.map((r) => {
        const row = byId.get(r.findingKey);
        const target = reasonTarget(r, row);
        return (
          <li key={r.findingKey}>
            <button
              className="gli"
              type="button"
              data-testid="gate-reason"
              data-finding-id={r.findingKey}
              data-kind={r.kind}
              data-target={target}
              onClick={() => {
                onGo();
                if (target === 'counsel') {
                  setRoute('counsel');
                  focusItem(r.findingKey);
                  return;
                }
                setRoute('findings');
                reset();
                select(r.findingKey);
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLElement>(
                      `[data-testid="finding-row"][data-finding-id="${CSS.escape(r.findingKey)}"]`,
                    )
                    ?.focus({ preventScroll: true }),
                );
              }}
            >
              <Icon name="stop" />
              <span>
                <b>{row?.f.title ?? r.findingKey}</b>
                <span className="why">
                  {row?.f.loc ?? ''} · {reasonText(r, row)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
