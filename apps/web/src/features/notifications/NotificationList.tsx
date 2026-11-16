import type { AppNotification } from '../../state/notifications';
import { isUnread } from '../../state/notifications';
import type { Role } from '../../state/projects';
import { NotificationRow } from './NotificationRow';

export function NotificationList({
  feed,
  role,
  projectNames,
  onOpen,
}: {
  feed: AppNotification[];
  role: Role;
  projectNames: ReadonlyMap<string, string>;
  onOpen: (n: AppNotification) => void;
}) {
  if (!feed.length)
    return (
      <p className="nt-empty" data-testid="notif-empty">
        You&apos;re all caught up.
      </p>
    );
  const now = Date.now();
  return (
    <ul className="nt-list" aria-label="Notifications">
      {feed.map((n) => (
        <NotificationRow
          key={n.id}
          n={n}
          unread={isUnread(n, role)}
          projectName={projectNames.get(n.projectId) ?? ''}
          now={now}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
