import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNotificationsDbForTest, useNotifications } from '../../state/notifications';
import { setProjectsDbForTest, useProjects } from '../../state/projects';
import * as h from '../review/v2/test-helpers';
import { buildSeedNotifications } from '../projects/notification-seed';
import { buildSeedProjects } from '../projects/seed';
import { NotificationBell } from './NotificationBell';

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const qa = (id: string) => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`),
];
const SEEDS = buildSeedProjects(
  ['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'].map((id) => ({
    id,
    title: id,
    firmId: null,
    fund: 'F',
    version: 'v1',
    members: [{ kind: 'sample' as const, sampleId: '01' }],
  })),
);
let mounted: { unmount(): void } | null = null;

function click(el: HTMLElement | null) {
  act(() => {
    el!.click();
  });
}

beforeEach(() => {
  h.installDomStubs();
  document.body.replaceChildren();
  setProjectsDbForTest(null);
  setNotificationsDbForTest(null);
  useProjects.setState({ projects: SEEDS, loaded: true, viewAs: 'approver', view: 'projects' });
  useNotifications.setState({ items: buildSeedNotifications(SEEDS), loaded: true });
});
afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setProjectsDbForTest(undefined);
  setNotificationsDbForTest(undefined);
});

describe('NotificationBell', () => {
  it('should badge the unread count for the current role and hide it at 0', () => {
    mounted = h.renderV2(<NotificationBell onOpen={() => undefined} />);
    expect(q('notif-badge')?.textContent).toBe('3');
    expect(q('notif-bell')?.getAttribute('aria-label')).toBe('Notifications, 3 unread');
    act(() => useProjects.setState({ viewAs: 'counsel' }));
    expect(q('notif-badge')?.textContent).toBe('1');
    act(() => useNotifications.setState({ items: [] }));
    expect(q('notif-badge')).toBeNull();
    expect(q('notif-bell')).not.toBeNull();
  });
  it('should open the popover with header, rows and the empty state', () => {
    mounted = h.renderV2(<NotificationBell onOpen={() => undefined} />);
    click(q('notif-bell'));
    expect(q('notif-heading')?.textContent).toBe('Notifications (3)');
    expect(qa('notif-row')).toHaveLength(3);
    expect(qa('notif-row').every((r) => r.dataset.unread === 'true')).toBe(true);
    expect(q('notif-popover')?.textContent).not.toContain('@');
    act(() => useNotifications.setState({ items: [] }));
    expect(q('notif-empty')?.textContent).toBe("You're all caught up.");
  });
  it('should mark read and call open with the project on row click', () => {
    const onOpen = vi.fn();
    mounted = h.renderV2(<NotificationBell onOpen={onOpen} />);
    click(q('notif-bell'));
    const row = qa('notif-row').find((r) => r.dataset.type === 'answers')!;
    click(row);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'seed-northgate-iii' }),
    );
    expect(q('notif-badge')?.textContent).toBe('2');
  });
  it('should zero the count with Mark all read', () => {
    mounted = h.renderV2(<NotificationBell onOpen={() => undefined} />);
    click(q('notif-bell'));
    click(q('notif-mark-all'));
    expect(q('notif-heading')?.textContent).toBe('Notifications (0)');
    expect(q('notif-badge')).toBeNull();
    expect((q('notif-mark-all') as HTMLButtonElement).disabled).toBe(true);
  });
  it('should close on Escape', () => {
    mounted = h.renderV2(<NotificationBell onOpen={() => undefined} />);
    click(q('notif-bell'));
    expect(q('notif-popover')).not.toBeNull();
    act(() => {
      q('notif-popover')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(q('notif-popover')).toBeNull();
  });
  it('should change the feed when View as changes', () => {
    mounted = h.renderV2(<NotificationBell onOpen={() => undefined} />);
    click(q('notif-bell'));
    const approver = qa('notif-row').map((r) => r.dataset.type);
    act(() => useProjects.setState({ viewAs: 'analyst' }));
    expect(qa('notif-row').map((r) => r.dataset.type)).not.toEqual(approver);
    expect(qa('notif-row').some((r) => r.dataset.type === 'member_added')).toBe(true);
  });
});
