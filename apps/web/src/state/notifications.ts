import { create } from 'zustand';
import {
  appDb,
  purgeNotificationsExpired,
  type AppDb,
  type ProjectRole,
  type StoredNotification,
  type StoredProject,
} from '../storage/db';

/**
 * Notifications v1 (client-only): five project events stored in the Dexie `notifications` table,
 * filtered by the advisory View-as role. Rows carry member names only (never emails) and nothing
 * here is ever written to the URL.
 */
export type { StoredNotification as AppNotification };

const ALL_ROLES: readonly ProjectRole[] = ['counsel', 'analyst', 'advisor', 'approver'];
const ROLE_NAME: Record<ProjectRole, string> = {
  counsel: 'Legal counsel',
  analyst: 'Digitization analyst',
  advisor: 'Advisor',
  approver: 'Approver',
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Short relative time: now, 5m, 3h, 1d, 2w. */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const d = Math.max(0, now - ts);
  if (d < MIN) return 'now';
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < WEEK) return `${Math.floor(d / DAY)}d`;
  return `${Math.floor(d / WEEK)}w`;
}

export function isUnread(n: StoredNotification, role: ProjectRole): boolean {
  return !n.readByRole[role];
}

/** The feed for one role: addressed to it, not its own action, project still exists, newest first. */
export function feedFor(
  all: readonly StoredNotification[],
  role: ProjectRole,
  projectsById?: ReadonlyMap<string, unknown> | Record<string, unknown>,
): StoredNotification[] {
  const has = (id: string) =>
    !projectsById
      ? true
      : projectsById instanceof Map
        ? projectsById.has(id)
        : Object.prototype.hasOwnProperty.call(projectsById, id);
  return all
    .filter((n) => n.forRoles.includes(role) && n.actor.role !== role && has(n.projectId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function unreadCount(feed: readonly StoredNotification[], role: ProjectRole): number {
  return feed.filter((n) => isUnread(n, role)).length;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const memberOf = (p: StoredProject, role: ProjectRole) => p.members.find((m) => m.role === role);
const recipients = (roles: readonly ProjectRole[], except?: ProjectRole) =>
  roles.filter((r) => r !== except);

function base(
  over: Omit<StoredNotification, 'id' | 'createdAt' | 'readByRole'>,
  now: number,
): StoredNotification | null {
  if (!over.forRoles.length) return null;
  return { id: newId(), createdAt: now, readByRole: {}, ...over };
}

export interface AnswerSeen {
  findingId: string;
  owner?: string;
  by: string;
  at: number;
}
export const answerKey = (a: AnswerSeen) => `${a.findingId}@${a.owner ?? 'counsel'}:${a.at}`;

/**
 * Counsel answered N questions: one event per batch of answers not covered by an earlier event
 * on this project (`seen` = answer keys already notified). Null when nothing is new.
 */
export function onAnswers(
  project: StoredProject,
  answers: readonly AnswerSeen[],
  seen: ReadonlySet<string>,
  now: number = Date.now(),
): StoredNotification | null {
  const fresh = answers.filter((a) => !seen.has(answerKey(a)));
  if (!fresh.length) return null;
  const keys = fresh.map(answerKey).sort();
  const latest = [...fresh].sort((a, b) => b.at - a.at)[0]!;
  const by = latest.by.trim() || 'Counsel';
  const n = fresh.length;
  return base(
    {
      dedupeKey: `answers:${project.id}:${hash(keys.join('|'))}`,
      type: 'answers',
      projectId: project.id,
      forRoles: ['analyst', 'approver', 'advisor'],
      actor: { name: by, role: 'counsel' },
      title: `${by} answered ${n} question${n === 1 ? '' : 's'}.`,
      target: 'questions',
      count: n,
      answerKeys: keys,
    },
    now,
  );
}

/** Creator name: the first counsel or analyst member, else "A teammate". */
export function creatorName(project: StoredProject): string {
  return (memberOf(project, 'counsel') ?? memberOf(project, 'analyst'))?.name ?? 'A teammate';
}

/** Added to a project: only the added member's role is notified (never the creator's own row). */
export function onMemberAdded(
  project: StoredProject,
  index: number,
  now: number = Date.now(),
): StoredNotification | null {
  const m = project.members[index];
  if (!m) return null;
  const creator = creatorName(project);
  if (creator === m.name) return null;
  return base(
    {
      dedupeKey: `member:${project.id}:${index}`,
      type: 'member_added',
      projectId: project.id,
      forRoles: [m.role],
      actor: { name: creator },
      title: `${creator} added you to ${project.name} as ${ROLE_NAME[m.role]}.`,
      target: 'questions',
    },
    now,
  );
}

/** New version uploaded: every role except the uploader's; never on the first document. */
export function onNewVersion(
  project: StoredProject,
  docId: string,
  uploaderRole: ProjectRole,
  count?: number,
  now: number = Date.now(),
): StoredNotification | null {
  if (!project.docIds.length || project.docIds.includes(docId)) return null;
  const actor = memberOf(project, uploaderRole)?.name ?? ROLE_NAME[uploaderRole];
  return base(
    {
      dedupeKey: `version:${project.id}:${docId}`,
      type: 'new_version',
      projectId: project.id,
      forRoles: recipients(ALL_ROLES, uploaderRole),
      actor: { name: actor, role: uploaderRole },
      title:
        typeof count === 'number' && count > 0
          ? `New version uploaded - ${count} change${count === 1 ? '' : 's'} to review.`
          : 'New version uploaded.',
      target: 'findings_changes',
      ...(typeof count === 'number' && count > 0 ? { count } : {}),
    },
    now,
  );
}

/** Gate Blocked -> Ready: the Approver is asked to sign off. */
export function onGateReady(
  project: StoredProject,
  cycle: string,
  now: number = Date.now(),
): StoredNotification | null {
  return base(
    {
      dedupeKey: `gate-ready:${project.id}:${cycle}`,
      type: 'gate_ready',
      projectId: project.id,
      forRoles: ['approver'],
      actor: { name: memberOf(project, 'counsel')?.name ?? 'Counsel', role: 'counsel' },
      title: `${project.name} is ready for your sign-off.`,
      target: 'questions',
    },
    now,
  );
}

/** Marked ready to digitize by the Approver: every other role is told. */
export function onMarkedReady(
  project: StoredProject,
  cycle: string,
  now: number = Date.now(),
): StoredNotification | null {
  const by = memberOf(project, 'approver')?.name ?? 'The Approver';
  return base(
    {
      dedupeKey: `marked-ready:${project.id}:${cycle}`,
      type: 'marked_ready',
      projectId: project.id,
      forRoles: recipients(ALL_ROLES, 'approver'),
      actor: { name: by, role: 'approver' },
      title: `${by} marked ${project.name} ready to digitize.`,
      target: 'questions',
    },
    now,
  );
}

/** Answer keys already notified on one project. */
export function seenAnswerKeys(
  items: readonly StoredNotification[],
  projectId: string,
): Set<string> {
  const out = new Set<string>();
  for (const n of items)
    if (n.type === 'answers' && n.projectId === projectId)
      for (const k of n.answerKeys ?? []) out.add(k);
  return out;
}

interface NotificationsState {
  items: StoredNotification[];
  loaded: boolean;
  /** Purge, insert missing seeds (idempotent by dedupeKey), then read every row. */
  load: (seeds?: readonly StoredNotification[]) => Promise<void>;
  emit: (n: StoredNotification | null) => Promise<boolean>;
  markRead: (id: string, role: ProjectRole) => void;
  markAllRead: (role: ProjectRole) => void;
  clearForTest: () => void;
}

let dbOverride: AppDb | null | undefined;
/** Tests: inject a database (null = memory only). */
export function setNotificationsDbForTest(db: AppDb | null | undefined): void {
  dbOverride = db;
}
const db = (): AppDb | null => (dbOverride !== undefined ? dbOverride : appDb());

async function persist(n: StoredNotification): Promise<void> {
  const d = db();
  if (d) await d.notifications.put(n).catch(() => undefined);
}

const newestFirst = (list: StoredNotification[]) =>
  [...list].sort((a, b) => b.createdAt - a.createdAt);

export const useNotifications = create<NotificationsState>((set, get) => ({
  items: [],
  loaded: false,
  load: async (seeds = []) => {
    const d = db();
    let rows: StoredNotification[];
    if (d) {
      try {
        await purgeNotificationsExpired(d);
        for (const s of seeds)
          if (!(await d.notifications.where('dedupeKey').equals(s.dedupeKey).count()))
            await d.notifications.put(s);
        rows = await d.notifications.toArray();
      } catch {
        rows = [...seeds];
      }
    } else {
      const have = new Set(get().items.map((n) => n.dedupeKey));
      rows = [...get().items, ...seeds.filter((s) => !have.has(s.dedupeKey))];
    }
    set({ items: newestFirst(rows), loaded: true });
  },
  emit: async (n) => {
    if (!n) return false;
    try {
      if (get().items.some((x) => x.dedupeKey === n.dedupeKey)) return false;
      const d = db();
      if (d && (await d.notifications.where('dedupeKey').equals(n.dedupeKey).count())) return false;
      set({ items: newestFirst([n, ...get().items]) });
      await persist(n);
      return true;
    } catch {
      return false;
    }
  },
  markRead: (id, role) => {
    const now = Date.now();
    const items = get().items.map((n) =>
      n.id === id && isUnread(n, role) ? { ...n, readByRole: { ...n.readByRole, [role]: now } } : n,
    );
    set({ items });
    const row = items.find((n) => n.id === id);
    if (row) void persist(row);
  },
  markAllRead: (role) => {
    const now = Date.now();
    const changed: StoredNotification[] = [];
    const items = get().items.map((n) => {
      if (!n.forRoles.includes(role) || !isUnread(n, role)) return n;
      const next = { ...n, readByRole: { ...n.readByRole, [role]: now } };
      changed.push(next);
      return next;
    });
    set({ items });
    for (const n of changed) void persist(n);
  },
  clearForTest: () => set({ items: [], loaded: false }),
}));

/** Fire-and-forget emit that never throws into the host flow. */
export function emitSafe(build: () => StoredNotification | null): void {
  try {
    void useNotifications
      .getState()
      .emit(build())
      .catch(() => undefined);
  } catch {
    // a notification must never break the action that triggered it
  }
}
