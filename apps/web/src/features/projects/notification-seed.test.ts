// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDb } from '../../storage/db';
import {
  feedFor,
  setNotificationsDbForTest,
  unreadCount,
  useNotifications,
} from '../../state/notifications';
import { buildSeedNotifications } from './notification-seed';
import { buildSeedProjects } from './seed';

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0);
const PROJECTS = buildSeedProjects(
  ['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'].map((id) => ({
    id,
    title: id,
    firmId: null,
    fund: 'F',
    version: 'v1',
    members: [{ kind: 'sample' as const, sampleId: '01' }],
  })),
  T0,
);

afterEach(() => setNotificationsDbForTest(undefined));

describe('buildSeedNotifications', () => {
  it('should build 3-5 events on existing seeded projects with no emails', () => {
    const seeds = buildSeedNotifications(PROJECTS, T0);
    expect(seeds.length).toBeGreaterThanOrEqual(3);
    expect(seeds.length).toBeLessThanOrEqual(5);
    const ids = new Set(PROJECTS.map((p) => p.id));
    for (const s of seeds) expect(ids.has(s.projectId)).toBe(true);
    expect(JSON.stringify(seeds)).not.toContain('@');
  });
  it('should give the default Approver 3 unread', () => {
    const feed = feedFor(buildSeedNotifications(PROJECTS, T0), 'approver');
    expect(unreadCount(feed, 'approver')).toBe(3);
  });
  it('should skip projects that are missing', () => {
    expect(buildSeedNotifications(PROJECTS.slice(2), T0)).toHaveLength(1);
  });
  it('should insert seeds idempotently on load', async () => {
    const db = new AppDb('notif-seed-test');
    setNotificationsDbForTest(db);
    await db.projects.bulkPut(PROJECTS);
    const seeds = buildSeedNotifications(PROJECTS, Date.now());
    await useNotifications.getState().load(seeds);
    await useNotifications.getState().load(buildSeedNotifications(PROJECTS, Date.now()));
    expect(await db.notifications.count()).toBe(seeds.length);
    db.close();
  });
});
