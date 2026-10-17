// seed:check — regenerates migration 0003, seed/demo.sql and seed/test-seed.sql and diffs them
// against the committed files. Each seed file must RECORD its expected spec (demo.sql ->
// fixtures/memory/demo-seed-spec.json, test-seed.sql -> fixtures/memory/_test-seed-spec.json), so
// the deployed demo seed can never silently fall back to the Firm X/Y test spec.
// Also runs the guard:cf and secrets:scan `scanText` over every migration and the seed, since
// the repo-wide guards skip `.sql` files.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanText as cfScan } from '../guards/guard-cf';
import { scanText as secretScan } from '../guards/secrets-scan';
import {
  DEMO_SQL_PATH,
  REFERENCE_SQL_PATH,
  ROOT,
  generate,
  SPEC_FOR,
  TEST_SPEC,
  TEST_SQL_PATH,
  PHASE02_SPEC,
} from './gen-demo-seed';

const SPEC_LINE = /^-- spec: (\S+)$/m;

export function recordedSpecPath(demoSql: string): string {
  const m = SPEC_LINE.exec(demoSql);
  if (!m?.[1]) throw new Error('seed file has no "-- spec:" header line');
  const p = m[1];
  if (p !== TEST_SPEC && p !== PHASE02_SPEC) throw new Error(`unexpected recorded spec path ${p}`);
  return p;
}

function firstDiff(a: string, b: string): string {
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let i = 0; i < Math.max(al.length, bl.length); i++)
    if (al[i] !== bl[i]) return `line ${i + 1}`;
  return 'none';
}

export function checkSeed(root: string = ROOT): string[] {
  const problems: string[] = [];
  const read = (rel: string): string | null => {
    try {
      return readFileSync(resolve(root, rel), 'utf8');
    } catch {
      problems.push(`${rel}: missing (run pnpm seed:gen)`);
      return null;
    }
  };
  const committedRef = read(REFERENCE_SQL_PATH);
  if (committedRef !== null) {
    const fresh = generate(root, PHASE02_SPEC).reference;
    if (fresh !== committedRef)
      problems.push(
        `${REFERENCE_SQL_PATH}: differs from the generator (${firstDiff(fresh, committedRef)})`,
      );
  }
  for (const rel of [DEMO_SQL_PATH, TEST_SQL_PATH]) {
    const committed = read(rel);
    if (committed === null) continue;
    const want = SPEC_FOR[rel]!;
    const recorded = recordedSpecPath(committed);
    if (recorded !== want) {
      problems.push(`${rel}: built from ${recorded}, expected ${want} (run pnpm seed:gen)`);
      continue;
    }
    const fresh = generate(root, want).demo;
    if (fresh !== committed)
      problems.push(`${rel}: differs from the generator (${firstDiff(fresh, committed)})`);
  }
  const migDir = 'apps/worker/migrations';
  const sqlFiles = [
    ...readdirSync(resolve(root, migDir))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => `${migDir}/${f}`),
    DEMO_SQL_PATH,
    TEST_SQL_PATH,
  ];
  for (const rel of sqlFiles) {
    const text = read(rel);
    if (text === null) continue;
    for (const f of [...cfScan(rel, text), ...secretScan(rel, text)])
      problems.push(`${f.file}:${f.line}: ${f.rule}`);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let problems: string[];
  try {
    problems = checkSeed();
  } catch (e) {
    problems = [e instanceof Error ? e.message : 'seed:check failed'];
  }
  for (const p of problems) console.error(`seed:check: ${p}`);
  console.log(problems.length ? `seed:check: FAILED (${problems.length})` : 'seed:check: OK');
  process.exit(problems.length ? 1 : 0);
}
