import type { Rule } from '@aduin/core';
import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import type { MemoryApi } from '../../../api/memoryApi';
import { reasonLabel } from '../../review/reasons';
import { shortDate, type DecisionRowData } from '../decisions/DecisionRow';
import type { WriteDone } from '../decisions/ReopenDialog';
import type { MatchingDismissals } from '../memory-join';
import { MemoryDialog } from '../MemoryDialog';
import { MSG, runWrite } from '../write';

export const REJECT_NOTE =
  'A rejected suggestion can return only if new matching dismissals arrive.';

/**
 * Review a suggested rule (AC53/AC54). Approve and Reject send ONLY a fresh `client_op_id` (X2/X3:
 * no note or reason field; approve `text` would replace the rule text). Read-only sessions see the
 * suggestion without Approve/Reject.
 */
export function ReviewRuleDialog({
  rule,
  matching,
  firmName,
  readOnly,
  classLabel,
  api,
  onClose,
  onDone,
}: {
  rule: Rule;
  matching: MatchingDismissals;
  firmName: string;
  readOnly: boolean;
  classLabel: (code: string | null) => string;
  api: () => MemoryApi | null;
  onClose: () => void;
  onDone: WriteDone;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (mode: 'approve' | 'reject') => {
    const a = api();
    if (!a) {
      setError(MSG.retry);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await runWrite(() =>
      mode === 'approve' ? a.approveRule(rule.id) : a.rejectRule(rule.id),
    );
    setBusy(false);
    if (res.kind === 'cap') setError(MSG.cap);
    else if (res.kind === 'retry') setError(MSG.retry);
    else onDone(res.kind);
  };

  const rows: DecisionRowData[] = matching.decisions.map((d) => ({
    id: d.id,
    status: 'active',
    decision: d.decision,
    issueClass: d.issue_class ?? null,
    full: d,
    rev: null,
  }));

  return (
    <MemoryDialog
      kind="review"
      title="Review suggested rule"
      error={error}
      busy={busy}
      onClose={onClose}
      actions={
        readOnly ? null : (
          <>
            <button
              className="btn warn"
              type="button"
              data-testid="memory-reject"
              disabled={busy}
              onClick={() => void act('reject')}
            >
              <Icon name="x" />
              Reject
            </button>
            <button
              className="btn pri"
              type="button"
              data-testid="memory-approve"
              disabled={busy}
              onClick={() => void act('approve')}
            >
              <Icon name="check" />
              Approve rule
            </button>
          </>
        )
      }
    >
      <div className="sum">
        <b style={{ fontSize: 14, fontWeight: 600 }} data-testid="memory-review-text">
          {rule.text}
        </b>
        <span className="mut">
          For {firmName || 'this firm'}.
          {matching.reasonCode
            ? ` Same reason each time: ${reasonLabel(matching.reasonCode)}.`
            : ''}
        </span>
      </div>
      <div className="callout">
        <Icon name="info" />
        <span>
          <b>No effect until approved.</b> A suggestion does not change findings or the AI&rsquo;s
          context.
        </span>
      </div>
      {matching.via === 'none' ? (
        <p data-testid="memory-matching-none">Proposed from repeated dismissals.</p>
      ) : (
        <div>
          <div
            className="mut"
            style={{ marginBottom: 4, fontWeight: 600 }}
            data-testid="memory-matching-count"
          >
            Matching dismissals: {rows.length}
          </div>
          <ul className="ev" data-testid="memory-matching">
            {rows.map((r) => (
              <li key={r.id} data-testid="memory-matching-item" data-decision-id={r.id}>
                <span className="l1">
                  <span>{classLabel(r.issueClass)}</span>
                  <span>
                    {r.full?.fund_name} · {r.full?.decided_by_name},{' '}
                    {r.full ? shortDate(r.full.decided_at) : ''}
                  </span>
                </span>
                {r.full?.quote_snippet ? (
                  <span className="dq">
                    <q>{r.full.quote_snippet}</q>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mut" data-testid="memory-reject-note">
        {REJECT_NOTE}
      </p>
      {readOnly ? (
        <p className="mut" data-testid="memory-review-read-only">
          This demo workspace is read-only. Approve and Reject are not available here.
        </p>
      ) : null}
    </MemoryDialog>
  );
}
