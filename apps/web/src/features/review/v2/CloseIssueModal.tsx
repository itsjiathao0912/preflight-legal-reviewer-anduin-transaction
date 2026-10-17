import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Modal } from '../../../components/ui/modal';
import type { Row } from '../model';
import { closeError, closeReasonsFor, OTHER_NOTE_REQUIRED } from './reasons-map';
import type { CloseReasonKey } from './types';

/** P-9: "Close issue", except a memory re-confirm row keeps the DismissModal wording. */
export function closeTitle(row: Row | null): string {
  return row?.label === 'dismissed_reconfirm' ? 'Re-confirm this dismissal' : 'Close issue';
}

/**
 * D2 reason modal. "Real issue" is hidden when the gate would still treat an accepted row as open
 * (E24). No reason, or "Other" without a note, shows the error and keeps the modal open.
 */
export function CloseIssueModal({
  row,
  open,
  onClose,
  onSubmit,
}: {
  row: Row | null;
  open: boolean;
  onClose(): void;
  onSubmit(key: CloseReasonKey, note: string): Promise<void> | void;
}) {
  const [key, setKey] = useState<CloseReasonKey | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setKey(null);
      setNote('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const reasons = row ? closeReasonsFor(row) : [];
  const noteError = error === OTHER_NOTE_REQUIRED;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const err = closeError(key, note);
    if (err || key === null) {
      setError(err);
      if (err === OTHER_NOTE_REQUIRED) noteRef.current?.focus();
      else first.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(key, note.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={closeTitle(row)}
      description={row?.f.title ?? ''}
      testId="dismiss-modal"
      className="modal fv2-modal"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        first.current?.focus();
      }}
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="dform">
        <fieldset>
          <legend>
            Why are you closing it? <span>(required)</span>
          </legend>
          <div className="reasons fv2-reasons">
            {reasons.map((r, i) => (
              <label className="r" key={r.key}>
                <input
                  ref={i === 0 ? first : undefined}
                  type="radio"
                  name="close-reason"
                  value={r.key}
                  data-testid="dismiss-reason"
                  data-reason={r.key}
                  checked={key === r.key}
                  onChange={() => {
                    setKey(r.key);
                    setError(null);
                  }}
                />{' '}
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="nl" htmlFor="dismiss-note">
          Note{' '}
          <span>
            {key === 'other' ? '(required for "Other")' : '(optional, kept in the audit trail)'}
          </span>
        </label>
        <textarea
          id="dismiss-note"
          ref={noteRef}
          rows={2}
          data-testid="dismiss-note"
          value={note}
          maxLength={500}
          aria-invalid={noteError || undefined}
          onChange={(e) => {
            setNote(e.target.value);
            if (noteError) setError(null);
          }}
        />
        <div className={error ? 'err on' : 'err'} role="alert" data-testid="dismiss-error">
          {error ? (
            <>
              <Icon name="warn" />
              {error}
            </>
          ) : null}
        </div>
        <div className="acts">
          <button type="button" className="btn" data-testid="dismiss-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn pri" data-testid="dismiss-save" disabled={saving}>
            Close issue
          </button>
        </div>
      </form>
    </Modal>
  );
}
