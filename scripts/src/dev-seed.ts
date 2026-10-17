// `pnpm dev:stack:seeded` worker leg (Phase 08 S1.e2e-infra, G1/G4) — local seeded stack on :8788
// for the Playwright `stack-memory` project.
//
//   1. generate random per-run COOKIE_SIGNING_KEYS ({kid: >= 32-byte string}) + COOKIE_SIGNING_KID
//      (in memory only: never printed, never written, no `.dev.vars` is ever created);
//   2. recreate a throwaway persist dir under apps/worker/.wrangler/ (gitignored);
//   3. apply migrations 0001-0005, then the demo seed built by buildDemoSeedSql(spec, PHASE02_SPEC)
//      from fixtures/memory/demo-seed-spec.json (seed:gen is NOT run; apps/worker/seed/demo.sql
//      is untouched);
//   4. self-check the D1 holds sd01-sd03 and the proposed rule sr01 for partners-group;
//   5. spawn `wrangler dev --local --persist-to <dir> --port 8788 --var ...` with an argv array.
//
// Never `--remote`. The child env drops every secret-looking variable (same rule as slice:check).
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoSeedSql, loadSpec, PHASE02_SPEC } from './seed/gen-demo-seed.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKER_DIR = join(ROOT, 'apps', 'worker');
const MIGRATIONS_DIR = join(WORKER_DIR, 'migrations');
const PERSIST_DIR = join(WORKER_DIR, '.wrangler', 'e2e-stack-memory');
const DB_NAME = 'aduin-transaction-db';
const PORT = '8788';
const EXPECTED_MIGRATIONS = ['0001', '0002', '0003', '0004', '0005'];
const SECRET_ENV =
  /OPENROUTER|TURNSTILE|COOKIE_SIGNING|CLOUDFLARE_API|CF_API|API_KEY|SECRET|TOKEN/i;

function log(msg: string): void {
  console.log(`dev-seed: ${msg}`);
}

function fail(msg: string): never {
  console.error(`dev-seed: FAIL ${msg}`);
  process.exit(1);
}

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!SECRET_ENV.test(k)) env[k] = v;
  env['WRANGLER_SEND_METRICS'] = 'false';
  env['CI'] = '1';
  return env;
}

/** Fresh signing material per run; kid charset matches config.ts. */
export function makeCookieKeys(): { keysJson: string; kid: string } {
  const kid = `e2e${randomBytes(4).toString('hex')}`;
  const key = randomBytes(32).toString('base64url'); // 43 ASCII chars >= 32 bytes
  return { keysJson: JSON.stringify({ [kid]: key }), kid };
}

function wrangler(args: string[], capture = false): string {
  const r = spawnSync('pnpm', ['exec', 'wrangler', ...args], {
    cwd: WORKER_DIR,
    env: childEnv(),
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
  });
  if (r.status !== 0) fail(`wrangler ${args.slice(0, 3).join(' ')} exited ${r.status ?? r.signal}`);
  return capture ? r.stdout : '';
}

function d1File(file: string): void {
  wrangler(['d1', 'execute', DB_NAME, '--local', '--persist-to', PERSIST_DIR, '--file', file]);
}

function d1Query<T>(sql: string): T[] {
  const out = wrangler(
    ['d1', 'execute', DB_NAME, '--local', '--persist-to', PERSIST_DIR, '--json', '--command', sql],
    true,
  );
  const start = out.indexOf('[');
  if (start < 0) fail('d1 query returned no JSON');
  const parsed = JSON.parse(out.slice(start)) as { results?: T[] }[];
  return parsed.flatMap((r) => r.results ?? []);
}

function migrationFiles(): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const prefixes = files.map((f) => f.slice(0, 4));
  if (JSON.stringify(prefixes) !== JSON.stringify(EXPECTED_MIGRATIONS))
    fail(`expected migrations ${EXPECTED_MIGRATIONS.join(',')}, found ${prefixes.join(',')}`);
  return files.map((f) => join(MIGRATIONS_DIR, f));
}

function selfCheck(): void {
  const decisions = d1Query<{ id: string }>(
    "SELECT id FROM decision WHERE workspace_id = 'ws_demo' AND id IN ('sd01','sd02','sd03') ORDER BY id",
  ).map((r) => r.id);
  if (decisions.join(',') !== 'sd01,sd02,sd03')
    fail(`seed self-check: decisions ${decisions.join(',') || '(none)'}`);
  const rules = d1Query<{ id: string }>(
    "SELECT id FROM firm_rule WHERE workspace_id = 'ws_demo' AND id = 'sr01' AND status = 'proposed' AND law_firm_id = 'partners-group'",
  );
  if (rules.length !== 1) fail('seed self-check: proposed rule sr01 (partners-group) missing');
  const meta = d1Query<{ key: string; value: string }>(
    "SELECT key, value FROM app_meta WHERE key IN ('schema_version','seed_mode')",
  );
  const get = (k: string) => meta.find((m) => m.key === k)?.value;
  if (get('schema_version') !== '5' || get('seed_mode') !== '0')
    fail('seed self-check: schema_version must be 5 and seed_mode 0');
  log('self-check ok: sd01-sd03 + proposed sr01 (partners-group), schema 5, seed_mode 0');
}

function main(): void {
  if (existsSync(join(WORKER_DIR, '.dev.vars')))
    fail('apps/worker/.dev.vars exists; remove it (this script passes vars on the argv only)');
  rmSync(PERSIST_DIR, { recursive: true, force: true });
  mkdirSync(PERSIST_DIR, { recursive: true });
  log(`persist dir recreated: ${PERSIST_DIR}`);

  for (const f of migrationFiles()) {
    log(`apply ${f.slice(MIGRATIONS_DIR.length + 1)}`);
    d1File(f);
  }
  const seedFile = join(PERSIST_DIR, 'demo-seed.sql');
  writeFileSync(seedFile, buildDemoSeedSql(loadSpec(ROOT, PHASE02_SPEC), PHASE02_SPEC));
  log(`apply demo seed from ${PHASE02_SPEC}`);
  d1File(seedFile);
  selfCheck();

  const { keysJson, kid } = makeCookieKeys();
  const args = [
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--persist-to',
    PERSIST_DIR,
    '--ip',
    '127.0.0.1',
    '--port',
    PORT,
    '--var',
    `COOKIE_SIGNING_KEYS:${keysJson}`,
    '--var',
    `COOKIE_SIGNING_KID:${kid}`,
  ];
  log(`starting wrangler dev --local on 127.0.0.1:${PORT} (per-run cookie keys, not printed)`);
  const child = spawn('pnpm', args, { cwd: WORKER_DIR, env: childEnv(), stdio: 'inherit' });
  const stop = (sig: NodeJS.Signals) => {
    if (child.exitCode === null) child.kill(sig);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
}

main();
