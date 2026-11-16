import type { AppNotification } from '../../state/notifications';
import { relativeTime } from '../../state/notifications';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Deterministic avatar tone (token pairs only) from the actor's name. */
const TONES = ['a', 'b', 'c', 'd'] as const;
function tone(name: string): (typeof TONES)[number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length]!;
}

export function NotificationRow({
  n,
  unread,
  projectName,
  now,
  onOpen,
}: {
  n: AppNotification;
  unread: boolean;
  projectName: string;
  now: number;
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="nt-row"
        data-testid="notif-row"
        data-unread={unread ? 'true' : 'false'}
        data-type={n.type}
        onClick={() => onOpen(n)}
      >
        <span className="nt-dot" aria-hidden="true" />
        <span className={`nt-av nt-av-${tone(n.actor.name)}`} aria-hidden="true">
          {initials(n.actor.name) || '?'}
        </span>
        <span className="nt-body">
          <span className="nt-title">{n.title}</span>
          <span className="nt-sub">{projectName}</span>
        </span>
        <span className="nt-time">{relativeTime(n.createdAt, now)}</span>
        {unread ? <span className="sr">Unread.</span> : null}
      </button>
    </li>
  );
}
