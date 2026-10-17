import { GATE_REASON_TEXT, questionKey, type GateReason } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { useCounsel } from '../counsel/counsel-store';
import { isQuestion } from '../counsel/sheet-model';
import { memoryLabelText } from '../review/memory-labels';
import type { Row } from '../review/model';
import {
  GATE_GROUP_LABEL,
  GATE_GROUP_ORDER,
  gateGroups,
  isChangeRow,
  type GroupedReason,
} from '../variance/owner-groups';

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

/**
 * Variance P04 (F1, H6): reasons grouped by owner, list only: "You · Counsel · GP · Fund admin ·
 * Earlier funds" with counts (from the shared owner model; group sizes sum to the reasons, which are
 * per (finding, owner) pair). Documents without change rows or owner reasons keep the flat list.
 * `GateButton` (Intake's merged gate, badge and three-part render) is unchanged.
 */
export function GateReasons({
  reasons,
  rows,
  onGo,
}: {
  reasons: readonly GateReason[];
  rows: readonly Row[];
  onGo: () => void;
}) {
  const grouped = reasons.some((r) => r.owner) || rows.some(isChangeRow);
  if (!grouped) return <ReasonList items={reasons.map(plain(rows))} onGo={onGo} />;
  const g = gateGroups(reasons, rows);
  return (
    <div className="gpgroups" data-testid="gate-groups">
      {GATE_GROUP_ORDER.map((id) =>
        g[id].length ? (
          <div key={id} data-testid="gate-group" data-group={id} data-count={g[id].length}>
            <p className="gh">
              {GATE_GROUP_LABEL[id]} <span>{g[id].length}</span>
            </p>
            <ReasonList items={g[id]} onGo={onGo} />
          </div>
        ) : null,
      )}
    </div>
  );
}

const plain =
  (rows: readonly Row[]) =>
  (reason: GateReason): GroupedReason => ({
    reason,
    row: rows.find((x) => x.f.id === reason.findingKey),
    documentError: false,
  });

function ReasonList({ items, onGo }: { items: readonly GroupedReason[]; onGo: () => void }) {
  const select = useReview((s) => s.select);
  const setRoute = useShell((s) => s.setRoute);
  const reset = useFilters((s) => s.reset);
  const focusItem = useCounsel((s) => s.focusItem);
  return (
    <ul>
      {items.map(({ reason: r, row }) => {
        const target = reasonTarget(r, row);
        return (
          <li key={`${r.findingKey}@${r.owner ?? ''}`}>
            <button
              className="gli"
              type="button"
              data-testid="gate-reason"
              data-finding-id={r.findingKey}
              data-owner={r.owner}
              data-kind={r.kind}
              data-target={target}
              onClick={() => {
                onGo();
                if (target === 'counsel') {
                  setRoute('counsel');
                  focusItem(r.owner ? questionKey(r.findingKey, r.owner) : r.findingKey);
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
