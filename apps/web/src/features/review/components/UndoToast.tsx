import { useEffect } from 'react';
import { useReview } from '../../../state/review';

export function UndoToast() {
  const toast = useReview((s) => s.toast);
  const clear = useReview((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, toast.undo ? 7000 : 2600);
    return () => clearTimeout(t);
  }, [toast, clear]);
  if (!toast) return null;
  return (
    <div className="toast on" role="status" aria-live="polite" data-testid="undo-toast">
      <span>{toast.msg}</span>
      {toast.undo ? (
        <button
          type="button"
          data-testid="undo-button"
          onClick={() => {
            const u = toast.undo;
            clear();
            u?.();
          }}
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}
