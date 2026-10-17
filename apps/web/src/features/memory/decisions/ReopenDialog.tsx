import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import type { MemoryApi } from '../../../api/memoryApi';
import { MemoryDialog } from '../MemoryDialog';
import { MSG, runWrite } from '../write';
import type { DecisionRowData } from './DecisionRow';

export type WriteDone = (kind: 'ok' | 'changed' | 'readOnly') => void;

const REQUIRED = 'Enter a reason before reopening. The audit trail needs one.';

/**
 * Reopen a decision (AC50/AC52): reason required (1-500), one awaited `revoke(decisionId, reason)`
 * call (not outbox-queued). The decision stays listed as Reopened and the finding is New next time.
 */
export function ReopenDialog({
  row,
  firmName,
  api,
  onClose,
  onDone,
}: {
  row: DecisionRowData;
  firmName: string;
  api: () => MemoryApi | null;
  onClose: () => void;
  onDone: WriteDone;
}) {
  const [why, setWhy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const reason = why.trim();
    if (!reason) {
      setError(REQUIRED);
      return;
    }
    const a = api();
    if (!a) {
      setError(MSG.retry);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await runWrite(() => a.revoke(row.id, reason.slice(0, 500)));
    setBusy(false);
    if (res.kind === 'retry' || res.kind === 'cap') setError(MSG.retry);
    else onDone(res.kind);
  };

  return (
    <MemoryDialog
      kind="reopen"
      title="Reopen this decision?"
      error={error}
      busy={busy}
      onClose={onClose}
      onSubmit={() => void submit()}
      actions={
        <button
          className="btn pri"
          type="submit"
          data-testid="memory-dialog-submit"
          disabled={busy}
        >
          <Icon name="undo" />
          Reopen decision
        </button>
      }
    >
      {row.full?.quote_snippet ? (
        <div className="sum">
          <span className="dq">
            <q>{row.full.quote_snippet}</q>
          </span>
          {row.full.fund_name ? <div className="l1">{row.full.fund_name}</div> : null}
        </div>
      ) : null}
      <p>
        It stays listed as reopened, and the finding shows as New the next time{' '}
        {firmName || 'this firm'} documents are reviewed. This is recorded in the audit trail.
      </p>
      <label className="l">
        <span>
          Why are you reopening it? <span className="opt">(required)</span>
        </span>
        <textarea
          rows={2}
          maxLength={500}
          data-testid="memory-dialog-reason"
          placeholder="For example: counsel changed their answer"
          value={why}
          onChange={(e) => {
            setWhy(e.target.value);
            if (e.target.value.trim()) setError(null);
          }}
        />
      </label>
    </MemoryDialog>
  );
}
