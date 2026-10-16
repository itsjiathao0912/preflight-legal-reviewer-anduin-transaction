import type { ReasonCode } from '@aduin/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Modal } from '../../../components/ui/modal';
import { DISMISS_REASON_REQUIRED, DISMISS_REASONS } from '../reasons';

/** Dismiss modal: required reason from the fixed list, optional note; focus-trapped (Radix Dialog). */
export function DismissModal({
  open,
  title,
  reconfirm,
  onCancel,
  onSave,
  returnFocus,
}: {
  open: boolean;
  title: string;
  reconfirm: boolean;
  onCancel: () => void;
  onSave: (reason: ReasonCode, note: string) => Promise<string | null>;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const nextFocus = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote('');
      setError(false);
      nextFocus.current = null;
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError(true);
      first.current?.focus();
      return;
    }
    nextFocus.current = await onSave(reason, note.trim());
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title={reconfirm ? 'Re-confirm this dismissal' : 'Dismiss this finding'}
      description={title}
      testId="dismiss-modal"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        first.current?.focus();
      }}
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        const id = nextFocus.current;
        const target = id
          ? document.querySelector<HTMLElement>(
              `[data-testid="finding-row"][data-finding-id="${CSS.escape(id)}"]`,
            )
          : returnFocus.current;
        (target ?? returnFocus.current)?.focus({ preventScroll: true });
      }}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="dform">
        <fieldset>
          <legend>
            Why are you dismissing it? <span>(required)</span>
          </legend>
          <div className="reasons">
            {DISMISS_REASONS.map((r, i) => (
              <label className="r" key={r.code}>
                <input
                  ref={i === 0 ? first : undefined}
                  type="radio"
                  name="reason"
                  value={r.code}
                  data-testid="dismiss-reason"
                  checked={reason === r.code}
                  onChange={() => {
                    setReason(r.code);
                    setError(false);
                  }}
                />{' '}
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="nl" htmlFor="dismiss-note">
          Note <span>(optional, kept in the audit trail)</span>
        </label>
        <textarea
          id="dismiss-note"
          rows={2}
          data-testid="dismiss-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={error ? 'err on' : 'err'} role="alert" data-testid="dismiss-error">
          {error ? (
            <>
              <Icon name="warn" />
              {DISMISS_REASON_REQUIRED}
            </>
          ) : null}
        </div>
        <div className="acts">
          <button type="button" className="btn" data-testid="dismiss-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn pri" data-testid="dismiss-save">
            Save dismissal
          </button>
        </div>
      </form>
    </Modal>
  );
}
