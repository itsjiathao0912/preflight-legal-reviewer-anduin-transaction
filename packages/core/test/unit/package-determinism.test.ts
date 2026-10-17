import { describe, expect, it } from 'vitest';
import {
  designFiles,
  expectedJson,
  HARTWELL,
  rolesOf,
  runPackage,
} from '../helpers/package-fixtures';

const E = expectedJson();
const roles = (id: string) => (id === 'hartwell' ? undefined : rolesOf(E.design[id]!.files));

/** AC8 re-run on intake output: same input twice and shuffled order give byte-equal analysis. */
describe('package-determinism (AC8)', () => {
  it.each([
    ['hartwell', [HARTWELL.sub, HARTWELL.lpa, HARTWELL.prior]],
    ['northgate-iii', designFiles('northgate-iii')],
    ['lotus-bay-asia-ii', designFiles('lotus-bay-asia-ii')],
  ] as const)('%s: twice and shuffled are byte-equal', async (id, files) => {
    const opts = { roles: roles(id) };
    const a = JSON.stringify((await runPackage([...files], opts)).analysis);
    const b = JSON.stringify((await runPackage([...files], opts)).analysis);
    const c = JSON.stringify((await runPackage([...files].reverse(), opts)).analysis);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(a).not.toMatch(/"(?:createdAt|timestamp|ms|time)"/);
  });
});
