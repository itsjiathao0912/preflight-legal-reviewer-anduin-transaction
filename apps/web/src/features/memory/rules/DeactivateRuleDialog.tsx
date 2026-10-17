import type { Rule } from '@aduin/core';
import { useState } from 'react';
import type { MemoryApi } from '../../../api/memoryApi';
import type { WriteDone } from '../decisions/ReopenDialog';
import { MemoryDialog } from '../MemoryDialog';
import { MSG, runWrite } from '../write';

/**
 * Deactivate an active rule: reason required, sent as the revoke `text` (the Worker stores it as
 * the revoke reason). One awaited `revokeRule(id, reason)` call.
 */
export function DeactivateRuleDialog({
  rule,
  api,
  onClose,
  onDone,
}: {
  rule: Rule;
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
      setError('Enter a reason before deactivating.');
      return;
    }
    const a = api();
    if (!a) {
      setError(MSG.retry);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await runWrite(() => a.revokeRule(rule.id, reason.slice(0, 500)));
    setBusy(false);
    if (res.kind === 'retry' || res.kind === 'cap') setError(MSG.retry);
    else onDone(res.kind);
  };

  return (
    <MemoryDialog
      kind="deactivate"
      title="Deactivate this rule?"
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
          Deactivate rule
        </button>
      }
    >
      <div className="sum">
        <b style={{ fontSize: 14, fontWeight: 600 }}>{rule.text}</b>
      </div>
      <p>It stops being given to the AI as context. It stays in the audit trail.</p>
      <label className="l">
        <span>
          Why are you deactivating it? <span className="opt">(required)</span>
        </span>
        <textarea
          rows={2}
          maxLength={500}
          data-testid="memory-dialog-reason"
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
