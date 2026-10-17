import { useState, type FormEvent } from 'react';
import { Icon } from '../components/ui/icon';
import { changeAnalystName } from '../state/memory-sync';
import { ANALYST_NAME_MAX, useSession } from '../state/session';
import { isRail, useShell } from '../state/shell';

/**
 * Analyst badge (sidebar bottom). The name is the session name (default `Linh Tran`); a small,
 * dismissible inline edit changes it (stored in Dexie, re-bootstraps the memory session). It never
 * blocks the shell, and the `analyst-name` text stays the stored name while not editing.
 */
export function AnalystBadge() {
  const rail = useShell(isRail);
  const name = useSession((s) => s.analystName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 3);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await changeAnalystName(draft)) setEditing(false);
  };
  return (
    <div className="me" title={rail ? name : undefined}>
      <span className="av" aria-hidden="true">
        {initials}
      </span>
      {editing ? (
        <form className="me-form" onSubmit={(e) => void submit(e)}>
          <input
            aria-label="Your name"
            data-testid="analyst-name-input"
            maxLength={ANALYST_NAME_MAX}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setEditing(false);
              }
            }}
            onBlur={() => setEditing(false)}
          />
        </form>
      ) : (
        <>
          <span className="nm" data-testid="analyst-name">
            {name}
          </span>
          <button
            type="button"
            className="me-edit"
            data-testid="analyst-name-edit"
            aria-label="Change your name"
            title="Change your name"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            <Icon name="edit" />
          </button>
        </>
      )}
      <span className="sr">Signed in as {name}, digitization analyst</span>
    </div>
  );
}
