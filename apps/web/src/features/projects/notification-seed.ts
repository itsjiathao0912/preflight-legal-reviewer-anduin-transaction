import type { StoredNotification, StoredProject } from '../../storage/db';

/**
 * Notifications v1 seeds: 4 demo events on the seeded demo projects (names only, no emails).
 * Ids and dedupe keys are fixed so a reload never adds a second copy.
 */
const HOUR = 60 * 60 * 1000;

interface SeedEvent {
  key: string;
  projectId: string;
  type: StoredNotification['type'];
  forRoles: StoredNotification['forRoles'];
  actor: StoredNotification['actor'];
  title: string;
  target: StoredNotification['target'];
  count?: number;
  agoHours: number;
}

const EVENTS: SeedEvent[] = [
  {
    key: 'answers',
    projectId: 'seed-northgate-iii',
    type: 'answers',
    forRoles: ['analyst', 'approver', 'advisor'],
    actor: { name: 'Hannah Crane', role: 'counsel' },
    title: 'Hannah Crane answered 3 questions.',
    target: 'questions',
    count: 3,
    agoHours: 2,
  },
  {
    key: 'version',
    projectId: 'seed-northgate-iii',
    type: 'new_version',
    forRoles: ['counsel', 'approver', 'advisor'],
    actor: { name: 'Minh Tran', role: 'analyst' },
    title: 'New version uploaded - 5 changes to review.',
    target: 'findings_changes',
    count: 5,
    agoHours: 24,
  },
  {
    key: 'gate-ready',
    projectId: 'seed-lotus-bay-asia-ii',
    type: 'gate_ready',
    forRoles: ['approver'],
    actor: { name: 'Daniel Ostra', role: 'counsel' },
    title: 'Lotus Bay Asia II is ready for your sign-off.',
    target: 'questions',
    agoHours: 26,
  },
  {
    key: 'member',
    projectId: 'seed-redwood-ridge-i',
    type: 'member_added',
    forRoles: ['analyst'],
    actor: { name: 'Tom Becker' },
    title: 'Tom Becker added you to Redwood Ridge Fund I as Digitization analyst.',
    target: 'questions',
    agoHours: 72,
  },
];

/** Seed events for the seeded projects that exist (Approver sees 3 unread on first open). */
export function buildSeedNotifications(
  projects: readonly StoredProject[],
  now: number = Date.now(),
): StoredNotification[] {
  const ids = new Set(projects.filter((p) => p.seeded).map((p) => p.id));
  return EVENTS.filter((e) => ids.has(e.projectId)).map((e) => ({
    id: `seed-notif-${e.projectId}-${e.key}`,
    dedupeKey: `seed:${e.projectId}:${e.key}`,
    type: e.type,
    projectId: e.projectId,
    forRoles: [...e.forRoles],
    actor: { ...e.actor },
    title: e.title,
    target: e.target,
    ...(e.count ? { count: e.count } : {}),
    createdAt: now - e.agoHours * HOUR,
    readByRole: {},
    seeded: true,
  }));
}
