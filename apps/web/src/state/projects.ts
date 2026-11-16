import { create } from 'zustand';
import {
  appDb,
  purgeProjectsExpired,
  type AppDb,
  type ProjectGate,
  type ProjectMember,
  type ProjectRole,
  type StoredProject,
} from '../storage/db';
import { buildSeedNotifications } from '../features/projects/notification-seed';
import { emitSafe, onMemberAdded, onNewVersion, useNotifications } from './notifications';

/**
 * Projects v1 (client-only): the Projects landing page list, the open project and the advisory
 * "View as" role. Member emails stay in the Dexie `projects` table and this store only; the URL
 * never carries a project field (the active project id lives here, not in the hash). The active
 * project id (no email, no name) is kept in sessionStorage so a reload stays inside the project.
 */
export const ACTIVE_KEY = 'pj:v1:active';
function rememberActive(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage blocked: reload returns to the list */
  }
}
function readActive(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
export type Role = ProjectRole;
export type { ProjectMember, StoredProject as Project };

export const ROLES: readonly Role[] = ['counsel', 'analyst', 'advisor', 'approver'];
export const ROLE_LABEL: Record<Role, string> = {
  counsel: 'Legal counsel',
  analyst: 'Digitization analyst',
  advisor: 'Advisor',
  approver: 'Approver',
};
export const MARK_READY_REASON = 'Only the Approver can mark ready.';
export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const MEMBERS_MAX = 20;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

/** Only the Approver may press Mark ready to digitize (advisory, UI-only). */
export function canMarkReady(role: Role): boolean {
  return role === 'approver';
}

export function gateStatusFor(p: StoredProject): ProjectGate {
  return p.summary?.gate ?? 'not_started';
}

export function openItemsFor(p: StoredProject): number {
  return p.summary?.openItems ?? 0;
}

export function lastActivityFor(p: StoredProject): number {
  return Math.max(p.updatedAt, p.summary?.lastActivity ?? 0);
}

/** "Needs my action": Approver acts on a ready gate; counsel and analyst act on a blocked one. */
export function needsMyAction(p: StoredProject, role: Role): boolean {
  const gate = gateStatusFor(p);
  if (role === 'approver') return gate === 'ready';
  if (role === 'counsel') return gate === 'blocked' && openItemsFor(p) > 0;
  if (role === 'analyst') return gate !== 'ready';
  return false;
}

export interface ProjectInput {
  name: string;
  description?: string;
  members: { name: string; email: string; role: string }[];
}
export type ValidationResult =
  | { ok: true; value: { name: string; description: string; members: ProjectMember[] } }
  | { ok: false; message: string };

function isRole(x: string): x is Role {
  return (ROLES as readonly string[]).includes(x);
}

/** Name 1-200 (trimmed), description optional, each member: name, email shape, known role. */
export function validateProjectInput(input: ProjectInput): ValidationResult {
  const name = (input.name ?? '').trim();
  if (!name) return { ok: false, message: 'Enter a project name.' };
  if (name.length > NAME_MAX)
    return { ok: false, message: `Keep the name under ${NAME_MAX + 1} characters.` };
  const description = (input.description ?? '').trim();
  if (description.length > DESCRIPTION_MAX)
    return { ok: false, message: `Keep the description under ${DESCRIPTION_MAX + 1} characters.` };
  if (input.members.length > MEMBERS_MAX)
    return { ok: false, message: `A project can have up to ${MEMBERS_MAX} members.` };
  const members: ProjectMember[] = [];
  for (const m of input.members) {
    const mName = (m.name ?? '').trim();
    const email = (m.email ?? '').trim();
    if (!mName && !email) continue; // an untouched empty row is ignored
    if (!mName || mName.length > NAME_MAX) return { ok: false, message: 'Enter each member name.' };
    if (!EMAIL_RE.test(email) || email.length > 254)
      return { ok: false, message: `Enter a valid email for ${mName}.` };
    if (!isRole(m.role)) return { ok: false, message: `Choose a role for ${mName}.` };
    members.push({ name: mName, email, role: m.role });
  }
  return { ok: true, value: { name, description, members } };
}

function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ProjectsView = 'projects' | 'project';

interface ProjectsState {
  projects: StoredProject[];
  loaded: boolean;
  activeProjectId: string | null;
  viewAs: Role;
  view: ProjectsView;
  load: (seeds?: () => Promise<StoredProject[]>) => Promise<void>;
  create: (input: ProjectInput) => Promise<ValidationResult & { id?: string }>;
  open: (id: string) => void;
  closeToList: () => void;
  /** After load: reopen the project remembered for this tab when it still exists. */
  restoreActive: () => boolean;
  setViewAs: (role: Role) => void;
  setView: (view: ProjectsView) => void;
  attachDoc: (docId: string) => void;
}

const sortProjects = (list: StoredProject[]) =>
  [...list].sort((a, b) => lastActivityFor(b) - lastActivityFor(a));

let dbOverride: AppDb | null | undefined;
/** Tests: inject a database (null = memory only). */
export function setProjectsDbForTest(db: AppDb | null | undefined): void {
  dbOverride = db;
}
const db = (): AppDb | null => (dbOverride !== undefined ? dbOverride : appDb());

async function persist(p: StoredProject): Promise<void> {
  const d = db();
  if (d) await d.projects.put(p).catch(() => undefined);
}

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: [],
  loaded: false,
  activeProjectId: null,
  // default Approver: existing flows keep Mark ready usable
  viewAs: 'approver',
  view: 'projects',
  load: async (seeds) => {
    const d = db();
    let rows: StoredProject[];
    const seedRows = seeds ? await seeds().catch(() => []) : [];
    if (d) {
      try {
        await purgeProjectsExpired(d);
        // seeded rows are re-created when absent (first load or after a purge)
        for (const s of seedRows) if (!(await d.projects.get(s.id))) await d.projects.put(s);
        rows = await d.projects.toArray();
      } catch {
        rows = seedRows;
      }
    } else {
      rows = [...get().projects.filter((p) => !p.seeded), ...seedRows];
    }
    set({ projects: sortProjects(rows), loaded: true });
    // Notifications v1: purge + idempotent demo seeds (never throws into the project load)
    await useNotifications
      .getState()
      .load(buildSeedNotifications(rows))
      .catch(() => undefined);
  },
  create: async (input) => {
    const v = validateProjectInput(input);
    if (!v.ok) return v;
    const now = Date.now();
    const p: StoredProject = {
      id: newId(),
      ...v.value,
      createdAt: now,
      updatedAt: now,
      docIds: [],
    };
    await persist(p);
    set({ projects: sortProjects([p, ...get().projects]) });
    p.members.forEach((_, i) => emitSafe(() => onMemberAdded(p, i, now)));
    return { ...v, id: p.id };
  },
  open: (id) => {
    const p = get().projects.find((x) => x.id === id);
    if (!p) return;
    const touched = { ...p, updatedAt: Date.now() };
    void persist(touched);
    rememberActive(id);
    set({
      activeProjectId: id,
      view: 'project',
      projects: sortProjects(get().projects.map((x) => (x.id === id ? touched : x))),
    });
  },
  closeToList: () => {
    rememberActive(null);
    set({ view: 'projects' });
  },
  restoreActive: () => {
    const id = readActive();
    if (!id) return false;
    if (!get().projects.some((p) => p.id === id)) {
      rememberActive(null);
      return false;
    }
    get().open(id);
    return true;
  },
  setViewAs: (viewAs) => set({ viewAs }),
  setView: (view) => set({ view }),
  attachDoc: (docId) => {
    const { activeProjectId, projects } = get();
    const p = projects.find((x) => x.id === activeProjectId);
    if (!p || p.docIds.includes(docId)) return;
    emitSafe(() => onNewVersion(p, docId, get().viewAs));
    const next = { ...p, docIds: [...p.docIds, docId], updatedAt: Date.now() };
    void persist(next);
    set({ projects: sortProjects(projects.map((x) => (x.id === p.id ? next : x))) });
  },
}));

export function activeProject(s: Pick<ProjectsState, 'projects' | 'activeProjectId'>) {
  return s.projects.find((p) => p.id === s.activeProjectId) ?? null;
}
