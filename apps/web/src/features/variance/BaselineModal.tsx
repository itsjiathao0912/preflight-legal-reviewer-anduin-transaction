import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../../components/ui/icon';
import { Modal } from '../../components/ui/modal';
import type { BaselineRef } from './types';

/**
 * Baseline picker: only same-firm earlier documents whose text is in the browser. The suggested
 * item is pre-checked; the error shows only on submit with nothing selected, never on open.
 */
export function BaselineModal({
  open,
  firmName,
  candidates,
  current,
  onCancel,
  onChoose,
}: {
  open: boolean;
  firmName: string;
  candidates: BaselineRef[];
  current: string | null;
  onCancel: () => void;
  onChoose: (docId: string) => Promise<boolean>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(current ?? candidates[0]?.docId ?? null);
    setError(null);
  }, [open, current, candidates]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!candidates.length) {
      onCancel();
      return;
    }
    if (!picked) {
      setError('Pick a baseline.');
      first.current?.focus();
      return;
    }
    const ok = await onChoose(picked);
    if (!ok) setError('This document cannot be the baseline.');
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title="Compare against"
      description="Changes are classified against one earlier document from this firm."
      testId="baseline-modal"
    >
      <form noValidate onSubmit={(e) => void submit(e)} className="dform">
        <fieldset className="bsrc">
          <legend>Earlier documents of {firmName || 'this firm'}</legend>
          {candidates.length ? (
            candidates.map((c, i) => (
              <label key={c.docId}>
                <input
                  ref={i === 0 ? first : undefined}
                  type="radio"
                  name="baseline"
                  value={c.docId}
                  data-testid="baseline-option"
                  checked={picked === c.docId}
                  onChange={() => {
                    setPicked(c.docId);
                    setError(null);
                  }}
                />
                {c.name}
              </label>
            ))
          ) : (
            <p className="mut" data-testid="baseline-none">
              No earlier documents from this firm. This review becomes the baseline.
            </p>
          )}
        </fieldset>
        <div className={error ? 'err on' : 'err'} role="alert" data-testid="baseline-error">
          {error ? (
            <>
              <Icon name="warn" />
              {error}
            </>
          ) : null}
        </div>
        <div className="acts">
          <button type="button" className="btn" data-testid="baseline-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn pri" data-testid="baseline-submit">
            {candidates.length ? 'Use this baseline' : 'Continue'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
