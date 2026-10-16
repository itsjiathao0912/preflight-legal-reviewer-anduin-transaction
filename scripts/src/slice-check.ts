// `pnpm slice:check` — Milestone 1 slice check (owned by Phase 04a).
//
//   --worker-only  (04a-WORKER closure; runs while Phase 03 is held)
//     start `pnpm exec wrangler dev --local` from apps/worker with an EMPTY temp --assets dir
//     (the configured web build may not exist), no OpenRouter/Turnstile/cookie secrets in the
//     child env, then assert: GET /api/health 200; GET /api/quota 200 {ai, ocr_pages, global_ok};
//     POST /api/ai fails closed before any upstream call (no outbound openrouter.ai);
//     run `pnpm guard:cf` and `pnpm secrets:scan`; tear the dev server down on success AND failure.
//
//   (no flag)      full M1 mode: core goldens, web build, the worker-only steps, then Playwright
//     (`stack` project) on apps/web/e2e/slice.spec.ts. Deferred until Phase 03 is VERIFIED: if
//     the spec does not exist yet this exits 1 ("deferred: depends on Phase 03"), never green.
//
// Never `--remote`. Never prints secrets. Unknown arguments exit 2.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKER_DIR = join(ROOT, 'apps', 'worker');
const SLICE_SPEC = join(ROOT, 'apps', 'web', 'e2e', 'slice.spec.ts');
const READY_TIMEOUT_MS = 90_000;
const SECRET_ENV =
  /OPENROUTER|TURNSTILE|COOKIE_SIGNING|CLOUDFLARE_API|CF_API|API_KEY|SECRET|TOKEN/i;

class CheckError extends Error {}

function fail(msg: string): never {
  throw new CheckError(msg);
}

function step(msg: string): void {
  console.log(`slice:check: ${msg}`);
}

export function parseArgs(argv: readonly string[]): { workerOnly: boolean } {
  let workerOnly = false;
  for (const a of argv) {
    if (a === '--worker-only') workerOnly = true;
    else throw new CheckError(`unknown argument: ${JSON.stringify(a)} (allowed: --worker-only)`);
  }
  return { workerOnly };
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.unref();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close(() => (port ? res(port) : rej(new Error('no free port'))));
    });
  });
}

function childEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!SECRET_ENV.test(k)) env[k] = v;
  env['WRANGLER_SEND_METRICS'] = 'false';
  env['CI'] = '1';
  return env;
}

function run(cmd: string, args: string[], cwd = ROOT): void {
  step(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: childEnv() });
  if (r.status !== 0) fail(`${cmd} ${args.join(' ')} exited ${r.status ?? r.signal}`);
}

async function killGroup(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null) return;
  const exited = new Promise<void>((r) => child.once('exit', () => r()));
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }
  const t = setTimeout(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      // already gone
    }
  }, 5_000);
  await exited;
  clearTimeout(t);
}

async function waitReady(base: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail(`wrangler dev exited early (code ${child.exitCode})`);
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (r.status === 200) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail('wrangler dev did not become ready');
}

function isBucket(x: unknown): boolean {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Record<string, unknown>;
  return ['used', 'limit', 'resets_at'].every(
    (k) => Number.isInteger(b[k]) && (b[k] as number) >= 0,
  );
}

async function workerChecks(base: string): Promise<void> {
  const health = await fetch(`${base}/api/health`);
  if (health.status !== 200) fail(`/api/health -> ${health.status}`);
  step('GET /api/health -> 200');

  const q = await fetch(`${base}/api/quota`, { headers: { 'x-aduin-client': '1' } });
  if (q.status !== 200) fail(`/api/quota -> ${q.status}`);
  if (!(q.headers.get('content-type') ?? '').includes('application/json'))
    fail('/api/quota is not JSON');
  if (q.headers.get('cache-control') !== 'no-store')
    fail('/api/quota lacks cache-control: no-store');
  const body = (await q.json()) as Record<string, unknown>;
  if (
    !isBucket(body['ai']) ||
    !isBucket(body['ocr_pages']) ||
    typeof body['global_ok'] !== 'boolean'
  )
    fail(`/api/quota shape mismatch: ${JSON.stringify(body).slice(0, 200)}`);
  step(`GET /api/quota -> 200 ${JSON.stringify(body)}`);

  // No key/platform in the dev stack: AI must fail closed BEFORE any upstream call.
  const ai = await fetch(`${base}/api/ai`, {
    method: 'POST',
    headers: {
      'x-aduin-client': '1',
      origin: base,
      'content-type': 'application/json',
      'x-aduin-turnstile': 'XXXX.DUMMY.TOKEN.XXXX',
    },
    body: JSON.stringify({
      v: 1,
      law_firm_id: null,
      candidates: [{ id: 'c1', quote: 'Subject to this Section 11.', section_path: ['1'] }],
      settings: {},
    }),
  });
  const aiText = await ai.text();
  if (ai.status === 200) fail('/api/ai answered 200 without a key (expected fail-closed)');
  if (!/"code":"(quota_exhausted|invalid_session|budget_cap)"/.test(aiText))
    fail(`/api/ai unexpected refusal: ${ai.status}`);
  step(`POST /api/ai -> ${ai.status} fail-closed (no upstream call)`);
}

async function workerOnly(): Promise<void> {
  for (const f of ['.dev.vars', '.env'])
    if (existsSync(join(WORKER_DIR, f)))
      fail(`apps/worker/${f} exists; refusing to start with local secrets`);
  const port = await freePort();
  const assets = mkdtempSync(join(tmpdir(), 'aduin-slice-assets-'));
  const base = `http://127.0.0.1:${port}`;
  const args = [
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--assets',
    assets,
  ];
  step(`$ pnpm ${args.join(' ').replace(assets, '<empty tmpdir>')} (cwd apps/worker)`);
  const child = spawn('pnpm', args, {
    cwd: WORKER_DIR,
    env: childEnv(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const capture = (d: Buffer) => {
    output += d.toString();
    if (output.length > 200_000) output = output.slice(-100_000);
  };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  const onSignal = () => {
    void killGroup(child).finally(() => process.exit(130));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await waitReady(base, child);
    await workerChecks(base);
    // The wrangler bindings table prints OPENROUTER_BASE_URL; any OTHER mention is a failure.
    const runtime = output
      .split('\n')
      .filter((l) => !/Environment Variable/.test(l))
      .join('\n');
    if (/openrouter\.ai/i.test(runtime))
      fail('dev server output mentions openrouter.ai (possible outbound call)');
    step('no outbound openrouter.ai call observed');
  } catch (e) {
    console.error('slice:check: wrangler dev output (tail):');
    console.error(output.slice(-4_000));
    throw e;
  } finally {
    await killGroup(child);
    rmSync(assets, { recursive: true, force: true });
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    step('dev server torn down; temp assets dir removed');
  }
  run('pnpm', ['guard:cf']);
  run('pnpm', ['secrets:scan']);
}

async function full(): Promise<void> {
  if (!existsSync(SLICE_SPEC))
    fail(
      'full mode deferred: depends on Phase 03 (apps/web/e2e/slice.spec.ts not authored yet); use --worker-only',
    );
  run('pnpm', ['--filter', '@aduin/core', 'test:golden']);
  run('pnpm', ['--filter', '@aduin/web', 'build']);
  await workerOnly();
  run('pnpm', [
    '--filter',
    '@aduin/web',
    'exec',
    'playwright',
    'test',
    '--project',
    'stack',
    'e2e/slice.spec.ts',
  ]);
}

async function main(): Promise<void> {
  const { workerOnly: wo } = parseArgs(process.argv.slice(2));
  if (wo) await workerOnly();
  else await full();
  step(`PASS (${wo ? 'worker-only' : 'full'})`);
}

main().catch((e: unknown) => {
  console.error(`slice:check: FAIL: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(e instanceof CheckError && /unknown argument/.test(e.message) ? 2 : 1);
});
