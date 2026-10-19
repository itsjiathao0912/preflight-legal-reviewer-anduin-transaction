import { useState } from 'react';
import { Modal } from '../components/ui/modal';
import { Icon } from '../components/ui/icon';
import { isRail, useShell } from '../state/shell';
import { startFresh } from './start-fresh';

/**
 * Sidebar footer action: "Start fresh" (analyst) or "Leave shared review" (counsel). Both clear the
 * session cookies and this browser's stored data, then reload into a new demo workspace.
 */
export function StartFresh({ counsel = false }: { counsel?: boolean }) {
  const rail = useShell(isRail);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const label = counsel ? 'Leave shared review' : 'Start fresh';
  return (
    <>
      <button
        type="button"
        className="sb-fresh"
        data-testid="start-fresh"
        title={label}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <Icon name="undo" />
        {rail ? null : <span>{label}</span>}
      </button>
      <Modal
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title={counsel ? 'Leave shared review?' : 'Start fresh?'}
        description={
          counsel
            ? 'This ends your counsel access in this browser and opens a new demo workspace.'
            : 'This clears documents, triage and questions in this browser and opens a new demo workspace. You can do this about 5 times a day.'
        }
        testId="start-fresh-dialog"
      >
        <div className="acts">
          <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn pri"
            data-testid="start-fresh-confirm"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void startFresh();
            }}
          >
            {counsel ? 'Leave' : 'Start fresh'}
          </button>
        </div>
      </Modal>
    </>
  );
}
