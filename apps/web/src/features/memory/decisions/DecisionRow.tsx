import type { ActiveDecision } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { reasonLabel } from '../../review/reasons';
import { humanClass } from '../memory-join';

/** One Decisions-tab row: an active decision, or a reopened one (full snapshot or lean). */
export interface DecisionRowData {
  id: string;
  status: 'active' | 'reopened';
  /** dismissed / accepted / answered (null on a lean reopened row without detail). */
  decision: string | null;
  issueClass: string | null;
  /** Full decision when known (active rows, rows reopened in this session). */
  full: ActiveDecision | null;
  rev: { who: string; at: number; reason: string | null } | null;
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DecisionBadge({ kind }: { kind: string | null }) {
  if (kind === 'accepted')
    return (
      <span className="badge b-ok">
        <Icon name="check" />
        Accepted
      </span>
    );
  if (kind === 'answered')
    return (
      <span className="badge b-new">
        <Icon name="counsel" />
        Answered
      </span>
    );
  if (kind === 'dismissed')
    return (
      <span className="badge b-note">
        <Icon name="x" />
        Dismissed
      </span>
    );
  return (
    <span className="badge b-st">
      <Icon name="memory" />
      Decision
    </span>
  );
}

export function decisionWhy(d: ActiveDecision): string {
  if (d.decision === 'answered')
    return d.counsel_option
      ? `Counsel chose ${d.counsel_option}${d.counsel_note ? `: ${d.counsel_note}` : ''}`
      : 'Counsel answered';
  return reasonLabel(d.reason_code) || d.note || '';
}

export function DecisionRow({
  row,
  classLabel,
  readOnly,
  onReopen,
}: {
  row: DecisionRowData;
  classLabel: (code: string | null) => string;
  readOnly: boolean;
  onReopen: (row: DecisionRowData) => void;
}) {
  const d = row.full;
  const reopened = row.status === 'reopened';
  const cls = row.issueClass ? classLabel(row.issueClass) : humanClass(null);
  const passage = d?.quote_snippet;
  const leanText = row.rev
    ? `Reopened by ${row.rev.who} on ${shortDate(row.rev.at)}${row.rev.reason ? `: ${row.rev.reason}` : ''}`
    : 'Reopened';
  return (
    <tr
      data-testid="memory-decision"
      data-decision-id={row.id}
      data-status={row.status}
      data-class={row.issueClass ?? ''}
      className={reopened ? 'revoked' : undefined}
    >
      <td>
        <DecisionBadge kind={row.decision} />
      </td>
      <td className="pass" title={passage ?? leanText}>
        {passage ? <q>{passage}</q> : <span className="lean">{leanText}</span>}
      </td>
      <td className="c-cls" title={cls}>
        {cls}
      </td>
      <td title={d?.fund_name ?? ''}>{d?.fund_name ?? '—'}</td>
      <td
        title={
          d
            ? `${d.decided_by_name}, ${shortDate(d.decided_at)}${decisionWhy(d) ? ` · ${decisionWhy(d)}` : ''}`
            : ''
        }
      >
        {d ? d.decided_by_name : '—'}
      </td>
      <td>
        {reopened ? (
          <span className="tag t-re" title={leanText}>
            <Icon name="undo" />
            Reopened
          </span>
        ) : (
          <>
            <span className="tag t-new">
              <Icon name="check" />
              Active
            </span>{' '}
            <button
              className="linkbtn"
              type="button"
              data-testid="memory-reopen"
              aria-label={`Reopen decision ${row.id}`}
              disabled={readOnly}
              title={readOnly ? 'This demo workspace is read-only.' : undefined}
              onClick={() => onReopen(row)}
            >
              Reopen…
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
