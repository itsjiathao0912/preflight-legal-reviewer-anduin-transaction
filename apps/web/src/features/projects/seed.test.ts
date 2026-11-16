// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDb } from '../../storage/db';
import { setProjectsDbForTest, useProjects, validateProjectInput } from '../../state/projects';
import type { DemoPackage } from '../open-document/demo-packages';
import { buildSeedProjects } from './seed';

const pkg = (id: string): DemoPackage => ({
  id,
  title: id,
  firmId: null,
  fund: 'F',
  version: 'v1',
  members: [{ kind: 'sample', sampleId: '01' }],
});
const DEMOS = ['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i', 'other'].map(pkg);

let db: AppDb;
let n = 0;
beforeEach(() => {
  db = new AppDb(`seed-test-${++n}`);
  setProjectsDbForTest(db);
  useProjects.setState({ projects: [], loaded: false, activeProjectId: null });
});
afterEach(async () => {
  setProjectsDbForTest(undefined);
  db.close();
  await db.delete();
});

describe('seed', () => {
  it('should build 2-3 valid seeded projects referencing existing demo packages', () => {
    const seeds = buildSeedProjects(DEMOS);
    expect(seeds.length).toBeGreaterThanOrEqual(2);
    expect(seeds.length).toBeLessThanOrEqual(3);
    for (const s of seeds) {
      expect(s.seeded).toBe(true);
      expect(DEMOS.map((d) => d.id)).toContain(s.demoPackageId);
      expect(validateProjectInput(s).ok).toBe(true);
      for (const m of s.members) expect(m.email.endsWith('@example.com')).toBe(true);
    }
  });

  it('should skip seeds whose demo package is missing from the build', () => {
    expect(buildSeedProjects([pkg('northgate-iii')]).map((s) => s.demoPackageId)).toEqual([
      'northgate-iii',
    ]);
    expect(buildSeedProjects([])).toEqual([]);
  });

  it('should seed on first load and stay idempotent on reload', async () => {
    const seeds = () => Promise.resolve(buildSeedProjects(DEMOS));
    await useProjects.getState().load(seeds);
    const first = useProjects.getState().projects.length;
    expect(first).toBe(3);
    await useProjects.getState().load(seeds);
    expect(useProjects.getState().projects).toHaveLength(first);
    expect(await db.projects.count()).toBe(first);
  });

  it('should re-create a seeded row that was removed', async () => {
    const seeds = () => Promise.resolve(buildSeedProjects(DEMOS));
    await useProjects.getState().load(seeds);
    await db.projects.delete('seed-northgate-iii');
    await useProjects.getState().load(seeds);
    expect(await db.projects.get('seed-northgate-iii')).toBeTruthy();
  });
});
