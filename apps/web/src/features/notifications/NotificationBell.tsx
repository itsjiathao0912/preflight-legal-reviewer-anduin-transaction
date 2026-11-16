import { useMemo, useState } from 'react';
import { Popover } from '../../components/ui/popover';
import {
  feedFor,
  unreadCount,
  useNotifications,
  type AppNotification,
} from '../../state/notifications';
import { useProjects } from '../../state/projects';
import { NotificationList } from './NotificationList';
import { openNotificationTarget } from './navigate';

/** Bell with an unread badge for the current View-as role; opens the notifications popover. */
export function NotificationBell({
  onOpen = openNotificationTarget,
}: {
  onOpen?: (n: AppNotification) => void;
}) {
  const items = useNotifications((s) => s.items);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const projects = useProjects((s) => s.projects);
  const role = useProjects((s) => s.viewAs);
  const [open, setOpen] = useState(false);
  const names = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const feed = useMemo(() => feedFor(items, role, names), [items, role, names]);
  const unread = unreadCount(feed, role);
  const select = (n: AppNotification) => {
    markRead(n.id, role);
    setOpen(false);
    onOpen(n);
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Notifications"
      className="nt-pop"
      testId="notif-popover"
      trigger={
        <button
          type="button"
          className="nt-bell"
          data-testid="notif-bell"
          aria-label={`Notifications, ${unread} unread`}
        >
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M10 20.5a2 2 0 0 0 4 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {unread > 0 ? (
            <span className="nt-badge" data-testid="notif-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      }
    >
      <div className="nt-head">
        <h2 className="nt-h" data-testid="notif-heading">
          Notifications ({unread})
        </h2>
        <button
          type="button"
          className="btn sm ghost"
          data-testid="notif-mark-all"
          disabled={unread === 0}
          onClick={() => markAllRead(role)}
        >
          Mark all read
        </button>
      </div>
      <NotificationList feed={feed} role={role} projectNames={names} onOpen={select} />
    </Popover>
  );
}
