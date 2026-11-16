// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AppDb,
  PROJECT_RETENTION_MS,
  purgeExpired,
  purgeProjectsExpired,
  RETENTION_MS,
  type StoredProject,
} from '../storage/db';
import {
  ACTIVE_KEY,
  gateStatusFor,
  needsMyAction,
  setProjectsDbForTest,
  useProjects,
  validateProjectInput,
} from './projects';

const T0 = Date.UTC(2026, 10, 15, 6, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
let db: AppDb;
let n = 0;

const project = (over: Partial<StoredProject> = {}): StoredProject => ({
  id: 'p1',
  name: 'P',
  description: '',
  members: [],
  createdAt: T0,
  updatedAt: T0,
  docIds: [],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = new AppDb(`projects-test-${++n}`);
  setProjectsDbForTest(db);
  useProjects.setState({
    projects: [],
    loaded: false,
    activeProjectId: null,
    viewAs: 'approver',
    view: 'projects',
  });
});
afterEach(async () => {
  vi.useRealTimers();
  setProjectsDbForTest(undefined);
  db.close();
  await db.delete();
});

describe('projects: validation', () => {
  it('should require a trimmed name of 1-200 characters', () => {
    expect(validateProjectInput({ name: '   ', members: [] }).ok).toBe(false);
    expect(validateProjectInput({ name: 'x'.repeat(201), members: [] }).ok).toBe(false);
    const ok = validateProjectInput({ name: '  Fund  ', members: [] });
    expect(ok.ok && ok.value.name).toBe('Fund');
    expect(validateProjectInput({ name: 'x'.repeat(200), members: [] }).ok).toBe(true);
  });

  it('should check member email shape and role, and ignore an empty row', () => {
    const m = (email: string, role = 'approver') => ({ name: 'Ann', email, role });
    expect(validateProjectInput({ name: 'P', members: [m('ann')] }).ok).toBe(false);
    expect(validateProjectInput({ name: 'P', members: [m('ann@x.co', 'boss')] }).ok).toBe(false);
    expect(
      validateProjectInput({ name: 'P', members: [{ name: 'Ann', email: '', role: 'approver' }] })
        .ok,
    ).toBe(false);
    const r = validateProjectInput({
      name: 'P',
      members: [m('ann@x.co'), { name: '', email: '', role: 'analyst' }],
    });
    expect(r.ok && r.value.members).toEqual([{ name: 'Ann', email: 'ann@x.co', role: 'approver' }]);
  });
});

describe('projects: store', () => {
  it('should create, persist and reload a project', async () => {
    const r = await useProjects.getState().create({
      name: 'Fund IV',
      description: 'Desc',
      members: [{ name: 'Ann', email: 'ann@x.co', role: 'counsel' }],
    });
    expect(r.ok).toBe(true);
    expect(useProjects.getState().projects[0]?.name).toBe('Fund IV');
    useProjects.setState({ projects: [] });
    await useProjects.getState().load();
    expect(useProjects.getState().projects.map((p) => p.name)).toEqual(['Fund IV']);
  });

  it('should not create an invalid project', async () => {
    const r = await useProjects.getState().create({ name: '', members: [] });
    expect(r.ok).toBe(false);
    expect(await db.projects.count()).toBe(0);
  });

  it('should open a project, keep its id out of the URL, and go back to the list', async () => {
    await db.projects.put(project());
    await useProjects.getState().load();
    useProjects.getState().open('p1');
    expect(useProjects.getState().view).toBe('project');
    expect(useProjects.getState().activeProjectId).toBe('p1');
    useProjects.getState().attachDoc('d1');
    useProjects.getState().attachDoc('d1');
    expect(useProjects.getState().projects[0]?.docIds).toEqual(['d1']);
    useProjects.getState().closeToList();
    expect(useProjects.getState().view).toBe('projects');
  });
});

describe('projects: active project survives a reload', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('should remember only the id and reopen the project after load', async () => {
    await db.projects.put(project({ members: [{ name: 'A', email: 'a@x.io', role: 'approver' }] }));
    await useProjects.getState().load();
    useProjects.getState().open('p1');
    expect(store.get(ACTIVE_KEY)).toBe('p1');
    expect([...store.values()].join()).not.toContain('@');
    // simulated reload: fresh store state, same tab storage
    useProjects.setState({ projects: [], activeProjectId: null, view: 'projects' });
    await useProjects.getState().load();
    expect(useProjects.getState().restoreActive()).toBe(true);
    expect(useProjects.getState().view).toBe('project');
    expect(useProjects.getState().activeProjectId).toBe('p1');
  });

  it('should fall back to the list when the remembered project is gone, and forget on back', async () => {
    store.set(ACTIVE_KEY, 'missing');
    await useProjects.getState().load();
    expect(useProjects.getState().restoreActive()).toBe(false);
    expect(useProjects.getState().view).toBe('projects');
    expect(store.has(ACTIVE_KEY)).toBe(false);
    await db.projects.put(project());
    await useProjects.getState().load();
    useProjects.getState().open('p1');
    useProjects.getState().closeToList();
    expect(store.has(ACTIVE_KEY)).toBe(false);
    expect(useProjects.getState().restoreActive()).toBe(false);
  });
});

describe('projects: purge', () => {
  it('should purge projects at 30 days, not at 24 h', async () => {
    await db.projects.bulkPut([
      project({ id: 'old', updatedAt: T0 - PROJECT_RETENTION_MS }),
      project({ id: 'day', updatedAt: T0 - 2 * DAY }),
    ]);
    expect(await purgeProjectsExpired(db, T0)).toBe(1);
    expect((await db.projects.toArray()).map((p) => p.id)).toEqual(['day']);
  });

  it('should leave projects untouched by the 24 h upload purge', async () => {
    await db.projects.put(project({ updatedAt: T0 - 2 * RETENTION_MS }));
    await purgeExpired(db, T0);
    expect(await db.projects.count()).toBe(1);
  });
});

describe('projects: derived flags', () => {
  it('should derive gate status and "needs my action" per role', () => {
    const blocked = project({ summary: { gate: 'blocked', openItems: 3, lastActivity: T0 } });
    const ready = project({ summary: { gate: 'ready', openItems: 0, lastActivity: T0 } });
    expect(gateStatusFor(project())).toBe('not_started');
    expect(needsMyAction(ready, 'approver')).toBe(true);
    expect(needsMyAction(blocked, 'approver')).toBe(false);
    expect(needsMyAction(blocked, 'counsel')).toBe(true);
    expect(needsMyAction(ready, 'counsel')).toBe(false);
    expect(needsMyAction(blocked, 'advisor')).toBe(false);
  });
});
