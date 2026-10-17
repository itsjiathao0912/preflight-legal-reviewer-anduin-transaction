import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import type { MemoryApi } from '../../../api/memoryApi';
import type { WriteDone } from '../decisions/ReopenDialog';
import { MemoryDialog } from '../MemoryDialog';
import { MSG, runWrite } from '../write';

/**
 * Add a firm rule (AI context only, never a filter): text 1-500 required (X4: no "Why" field).
 * One awaited `createRule(lawFirmId, text)` call; 429 `active_rule_cap` shows the cap message.
 */
export function AddRuleDialog({
  firmId,
  firmName,
  api,
  onClose,
  onDone,
}: {
  firmId: string;
  firmName: string;
  api: () => MemoryApi | null;
  onClose: () => void;
  onDone: WriteDone;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = text.trim();
    if (!t) {
      setError('Enter the rule text first.');
      return;
    }
    const a = api();
    if (!a) {
      setError(MSG.retry);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await runWrite(() => a.createRule(firmId, t.slice(0, 500)));
    setBusy(false);
    if (res.kind === 'cap') setError(MSG.cap);
    else if (res.kind === 'retry') setError(MSG.retry);
    else onDone(res.kind);
  };

  return (
    <MemoryDialog
      kind="add"
      title="Add a rule"
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
          <Icon name="plus" />
          Add rule
        </button>
      }
    >
      <p>
        Given to the AI as context when it reviews {firmName || 'this firm'} documents. It never
        hides or filters a finding.
      </p>
      <label className="l">
        <span>
          Rule <span className="opt">(required)</span>
        </span>
        <input
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          maxLength={500}
          data-testid="memory-dialog-text"
          placeholder="For example: “Units” is used for “Shares” in side letters. Not an error."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) setError(null);
          }}
        />
      </label>
    </MemoryDialog>
  );
}
