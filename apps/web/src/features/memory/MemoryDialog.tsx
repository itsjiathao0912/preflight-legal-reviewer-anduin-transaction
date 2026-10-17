import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Icon } from '../../components/ui/icon';

/**
 * Native `<dialog>` shell for the memory writes (app.html `#mem-dlg`, `.dlg` + `.dl` styling).
 * Escape, the close button and Cancel all close it; the caller owns submit and validation.
 */
export function MemoryDialog({
  kind,
  title,
  error,
  busy = false,
  onClose,
  onSubmit,
  children,
  actions,
}: {
  kind: 'reopen' | 'review' | 'add' | 'deactivate';
  title: string;
  error: string | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open && typeof d.showModal === 'function') d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeRef.current();
    };
    d.addEventListener('cancel', onCancel);
    // focus the first field (app.html: text input, else the reason box)
    d.querySelector<HTMLElement>('input[type="text"], textarea')?.focus();
    return () => {
      d.removeEventListener('cancel', onCancel);
      if (d.open && typeof d.close === 'function') d.close();
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit?.();
  };

  return (
    <dialog
      ref={ref}
      className="dlg"
      aria-labelledby="mem-dlgT"
      data-testid="memory-dialog"
      data-kind={kind}
    >
      <form className="dl" noValidate onSubmit={submit}>
        <div className="dh">
          <h2 id="mem-dlgT">{title}</h2>
          <button
            className="xb"
            type="button"
            aria-label="Close dialog"
            data-testid="memory-dialog-close"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        {children}
        <div className={`err${error ? ' on' : ''}`} role="alert" data-testid="memory-dialog-error">
          {error ? (
            <>
              <Icon name="warn" />
              {error}
            </>
          ) : null}
        </div>
        <div className="acts">
          <button
            className="btn"
            type="button"
            data-testid="memory-dialog-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          {actions}
        </div>
      </form>
    </dialog>
  );
}
