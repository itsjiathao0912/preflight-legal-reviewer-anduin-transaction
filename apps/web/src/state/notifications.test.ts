// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppDb,
  PROJECT_RETENTION_MS,
  purgeNotificationsExpired,
  type StoredNotification,
  type StoredProject,
} from '../storage/db';
import {
  feedFor,
  onAnswers,
  onGateReady,
  onMarkedReady,
  onMemberAdded,
  onNewVersion,
  relativeTime,
  seenAnswerKeys,
  setNotificationsDbForTest,
  unreadCount,
  useNotifications,
} from './notifications';

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
let db: AppDb;
let k = 0;

const project = (over: Partial<StoredProject> = {}): StoredProject => ({
  id: 'p1',
  name: 'Fund A',
  description: '',
  members: [
    { name: 'Hannah Crane', email: 'h@example.com', role: 'counsel' },
    { name: 'Minh Tran', email: 'm@example.com', role: 'analyst' },
    { name: 'Priya Shah', email: 'p@example.com', role: 'approver' },
  ],
  createdAt: T0,
  updatedAt: T0,
  docIds: [],
  ...over,
});

const ans = (findingId: string, at: number, by = 'Hannah Crane') => ({ findingId, by, at });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = new AppDb(`notif-test-${++k}`);
  setNotificationsDbForTest(db);
  useNotifications.getState().clearForTest();
});
afterEach(() => {
  vi.useRealTimers();
  setNotificationsDbForTest(undefined);
  db.close();
});

describe('relativeTime', () => {
  it.each([
    [10 * 1000, 'now'],
    [5 * MIN, '5m'],
    [3 * HOUR, '3h'],
    [1 * DAY, '1d'],
    [6 * DAY, '6d'],
    [14 * DAY, '2w'],
  ])('should format %i ms ago as %s', (ago, out) => {
    expect(relativeTime(T0 - ago, T0)).toBe(out);
  });
});

describe('emitters', () => {
  it('should build one answers event for new answers with N and the sentence', () => {
    const n = onAnswers(project(), [ans('f1', 1), ans('f2', 2)], new Set())!;
    expect(n.title).toBe('Hannah Crane answered 2 questions.');
    expect(n.forRoles).toEqual(['analyst', 'approver', 'advisor']);
    expect(n.actor.role).toBe('counsel');
    expect(n.target).toBe('questions');
    expect(onAnswers(project(), [ans('f1', 1)], new Set(n.answerKeys))).toBeNull();
    const next = onAnswers(project(), [ans('f1', 1), ans('f3', 3)], new Set(n.answerKeys))!;
    expect(next.title).toBe('Hannah Crane answered 1 question.');
  });
  it('should notify only the added member role with the role label', () => {
    const n = onMemberAdded(project(), 2)!;
    expect(n.forRoles).toEqual(['approver']);
    expect(n.title).toBe('Hannah Crane added you to Fund A as Approver.');
    expect(onMemberAdded(project(), 0)).toBeNull(); // the creator is never notified
    expect(JSON.stringify(n)).not.toContain('@');
  });
  it('should not emit new_version on the first document and omit an unknown count', () => {
    expect(onNewVersion(project(), 'd1', 'analyst')).toBeNull();
    const n = onNewVersion(project({ docIds: ['d1'] }), 'd2', 'analyst')!;
    expect(n.title).toBe('New version uploaded.');
    expect(n.forRoles).not.toContain('analyst');
    expect(n.target).toBe('findings_changes');
    expect(onNewVersion(project({ docIds: ['d1'] }), 'd2', 'analyst', 5)!.title).toBe(
      'New version uploaded - 5 changes to review.',
    );
  });
  it('should address gate_ready to the approver and marked_ready to every role but approver', () => {
    expect(onGateReady(project(), 'c1')!.forRoles).toEqual(['approver']);
    const m = onMarkedReady(project(), 'c1')!;
    expect(m.forRoles).toEqual(['counsel', 'analyst', 'advisor']);
    expect(m.title).toBe('Priya Shah marked Fund A ready to digitize.');
  });
});

describe('feed and read state', () => {
  const rows = (): StoredNotification[] => [
    onAnswers(project(), [ans('f1', 1)], new Set(), T0 - HOUR)!,
    onMemberAdded(project(), 1, T0 - 2 * HOUR)!,
    onMarkedReady(project(), 'c', T0)!,
  ];
  it('should filter by role, exclude own actions and sort newest first', () => {
    const all = rows();
    expect(feedFor(all, 'approver').map((n) => n.type)).toEqual(['answers']);
    expect(feedFor(all, 'analyst').map((n) => n.type)).toEqual([
      'marked_ready',
      'answers',
      'member_added',
    ]);
    expect(feedFor(all, 'counsel').map((n) => n.type)).toEqual(['marked_ready']);
    expect(feedFor(all, 'analyst', new Map())).toEqual([]);
  });
  it('should keep read state per role and mark all read for one role only', async () => {
    const s = useNotifications.getState();
    for (const n of rows()) await s.emit(n);
    const a = useNotifications.getState().items.find((n) => n.type === 'answers')!;
    useNotifications.getState().markRead(a.id, 'approver');
    let items = useNotifications.getState().items;
    expect(unreadCount(feedFor(items, 'approver'), 'approver')).toBe(0);
    expect(unreadCount(feedFor(items, 'analyst'), 'analyst')).toBe(3);
    useNotifications.getState().markAllRead('analyst');
    items = useNotifications.getState().items;
    expect(unreadCount(feedFor(items, 'analyst'), 'analyst')).toBe(0);
    expect(unreadCount(feedFor(items, 'advisor'), 'advisor')).toBe(2);
  });
});

describe('store', () => {
  it('should persist, reload and dedupe by dedupeKey', async () => {
    const n = onAnswers(project(), [ans('f1', 1)], new Set())!;
    expect(await useNotifications.getState().emit(n)).toBe(true);
    expect(await useNotifications.getState().emit({ ...n, id: 'other' })).toBe(false);
    await vi.waitFor(async () => expect(await db.notifications.count()).toBe(1));
    useNotifications.getState().clearForTest();
    await db.projects.put(project());
    await useNotifications.getState().load();
    expect(useNotifications.getState().items).toHaveLength(1);
    expect(seenAnswerKeys(useNotifications.getState().items, 'p1').size).toBe(1);
  });
  it('should purge rows at 30 days and rows of deleted projects', async () => {
    await db.projects.put(project());
    const keep = onMarkedReady(project(), 'a', T0 - DAY)!;
    const old = onMarkedReady(project(), 'b', T0 - PROJECT_RETENTION_MS)!;
    const orphan = onMarkedReady(project({ id: 'gone' }), 'c', T0)!;
    await db.notifications.bulkPut([keep, old, orphan]);
    expect(await purgeNotificationsExpired(db, T0)).toBe(2);
    expect((await db.notifications.toArray()).map((r) => r.id)).toEqual([keep.id]);
  });
});
