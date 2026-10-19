// Shared guards for the Phase 10 live/ops scripts (A6): target host allow-list, Cloudflare API
// allow-list (REST /accounts/** plus one accountTag-only GraphQL read), APPROVED-LIVE call and
// session ledgers, stop conditions, secret redaction and the mode-600 cookie handoff.
//
// Nothing here performs I/O against the network on import; every network-facing caller goes
// through `assertLiveBase` / `assertCfRequest` first. Never log cookies, tokens or API keys.
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DEFAULT_BASE = 'https://preflight-legal-reviewer.giathaowork.workers.dev';
export const WORKER_NAME = 'preflight-legal-reviewer';
export const COOKIE_NAME = '__Host-aduin_v';

export class LiveGuardError extends Error {}

function fail(msg: string): never {
  throw new LiveGuardError(msg);
}

// ---------------------------------------------------------------------------------------------
// Target host allow-list: https, a `aduin-transaction-*` (or exactly `preflight-legal-reviewer`) Worker on the `giathaowork` workers.dev
// subdomain, no credentials, no port, no path beyond `/`.
const LIVE_HOST =
  /^(?:aduin-transaction-[a-z0-9-]+|preflight-legal-reviewer)\.giathaowork\.workers\.dev$/;

/** Returns the normalized origin or throws. */
export function assertLiveBase(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    fail('base URL is not a valid URL');
  }
  if (u.protocol !== 'https:') fail('base URL must be https');
  if (!u.hostname.endsWith('.workers.dev')) fail('base URL host must be *.workers.dev');
  if (!LIVE_HOST.test(u.hostname))
    fail('base URL host is not an aduin-transaction workers.dev host');
  if (u.username || u.password) fail('base URL must not carry credentials');
  if (u.port) fail('base URL must not carry a port');
  if (u.pathname !== '/' || u.search || u.hash) fail('base URL must be an origin only');
  return u.origin;
}

/** Resolve `--base` / `LIVE_BASE_URL` / default, always through the allow-list. */
export function liveBase(flag: string | undefined): string {
  return assertLiveBase(flag ?? process.env['LIVE_BASE_URL'] ?? DEFAULT_BASE);
}

/** Absolute URL under the allowed base; refuses anything that escapes the origin. */
export function liveUrl(base: string, path: string): string {
  if (!path.startsWith('/')) fail('live path must start with /');
  const u = new URL(path, assertLiveBase(base));
  if (u.origin !== base) fail('live path escapes the allowed origin');
  return u.toString();
}

// ---------------------------------------------------------------------------------------------
// Cloudflare API allow-list.
export const CF_API = 'https://api.cloudflare.com';
const CF_GRAPHQL_PATH = '/client/v4/graphql';
const ACCOUNT_ID = /^[0-9a-f]{32}$/;

export type AnalyticsKind = 'd1RowsWritten' | 'workerCpu';

export interface AnalyticsVars {
  accountTag: string;
  since: string; // ISO datetime
  until: string; // ISO datetime
  /** D1 database id (d1RowsWritten) or Worker script name (workerCpu). */
  target: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * The only GraphQL query texts this repo may send: fixed templates filtered by `accountTag`.
 * Values travel in `variables`, never interpolated into the query text.
 */
export const ANALYTICS_TEMPLATES: Readonly<Record<AnalyticsKind, string>> = Object.freeze({
  d1RowsWritten: [
    'query D1Rows($accountTag: string!, $since: Time!, $until: Time!, $target: string!) {',
    '  viewer { accounts(filter: { accountTag: $accountTag }) {',
    '    d1AnalyticsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $since, datetime_leq: $until, databaseId: $target }) {',
    '      sum { rowsWritten rowsRead } dimensions { date }',
    '    } } } }',
  ].join('\n'),
  workerCpu: [
    'query WorkerCpu($accountTag: string!, $since: Time!, $until: Time!, $target: string!) {',
    '  viewer { accounts(filter: { accountTag: $accountTag }) {',
    '    workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $since, datetime_leq: $until, scriptName: $target }) {',
    '      sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }',
    '    } } } }',
  ].join('\n'),
});

export interface CfRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: { query: string; variables: Record<string, unknown> } | Record<string, unknown>;
}

/**
 * Explicit REST allow-list: exactly what Wave C needs from scripts. D1 create/migrate/execute,
 * secrets and deploy go through wrangler, never through these scripts. Anything else (routes,
 * `workers/domains`, `pages/projects/<p>/domains`, `d1/<id>/query`, deletes) is rejected.
 * Rollback of the widget (delete by id) is a manual, documented step.
 */
const CF_REST_ALLOW: ReadonlyArray<{ method: CfRequest['method']; tail: string }> = [
  { method: 'GET', tail: '/workers/scripts' }, // C1/C6 before/after name diff
  { method: 'GET', tail: '/d1/database' }, // C1/C6 before/after name diff
  { method: 'GET', tail: '/challenges/widgets' }, // C1/C6 before/after name diff
  { method: 'POST', tail: '/challenges/widgets' }, // C4 widget create
];
const CF_REST = /^\/client\/v4\/accounts\/([0-9a-f]{32})(\/[a-z0-9_/]+)$/;

/** Throws unless the request is inside the Cloudflare allow-list. */
export function assertCfRequest(req: CfRequest): void {
  const path = req.path;
  if (typeof path !== 'string' || !path.startsWith('/')) fail('cloudflare path must be absolute');
  // Raw-path checks before any parsing: no encoding tricks, no backslashes, no query/fragment.
  if (/[%\\]/.test(path)) fail('cloudflare path must not contain % or backslash');
  if (/[?#]/.test(path)) fail('cloudflare path must not carry a query or fragment');
  if (/zone/i.test(path)) fail('cloudflare zone paths are forbidden');
  if (path.includes('..') || path.includes('//') || path.includes('/./'))
    fail('cloudflare path is not normalized');
  let parsed: URL;
  try {
    parsed = new URL(path, CF_API);
  } catch {
    fail('cloudflare path does not parse');
  }
  if (parsed.origin !== CF_API || parsed.pathname !== path)
    fail('cloudflare path changes under URL parsing');
  if (path === CF_GRAPHQL_PATH) {
    if (req.method !== 'POST') fail('graphql must be POST');
    const body = req.body as { query?: unknown; variables?: unknown } | undefined;
    const query = typeof body?.query === 'string' ? body.query : '';
    if (/zone/i.test(query)) fail('graphql query must not mention zones');
    if (/mutation/i.test(query)) fail('graphql must be read-only');
    if (!Object.values(ANALYTICS_TEMPLATES).includes(query))
      fail('graphql query is not an allowed template');
    const vars = (body?.variables ?? {}) as Record<string, unknown>;
    if (JSON.stringify(vars).toLowerCase().includes('zone'))
      fail('graphql variables must not mention zones');
    if (typeof vars['accountTag'] !== 'string' || !ACCOUNT_ID.test(vars['accountTag']))
      fail('graphql accountTag missing or malformed');
    return;
  }
  const m = CF_REST.exec(path);
  if (!m) fail('cloudflare REST path must be under /client/v4/accounts/{account_id}');
  const tail = m[2];
  if (!CF_REST_ALLOW.some((a) => a.method === req.method && a.tail === tail))
    fail(`cloudflare REST ${req.method} ${tail} is not on the allow-list`);
}

/** Build the single allowed analytics request. */
export function analyticsRequest(kind: AnalyticsKind, vars: AnalyticsVars): CfRequest {
  if (!ACCOUNT_ID.test(vars.accountTag)) fail('accountTag malformed');
  if (!ISO.test(vars.since) || !ISO.test(vars.until)) fail('since/until must be ISO UTC datetimes');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(vars.target)) fail('analytics target malformed');
  const req: CfRequest = {
    method: 'POST',
    path: CF_GRAPHQL_PATH,
    body: { query: ANALYTICS_TEMPLATES[kind], variables: { ...vars } },
  };
  assertCfRequest(req);
  return req;
}

export interface CfCreds {
  email: string;
  key: string;
  accountId: string;
}

/** Read Cloudflare credentials from env only (the operator sources the credentials file). */
export function cfCredsFromEnv(env: NodeJS.ProcessEnv = process.env): CfCreds {
  const email = env['CLOUDFLARE_EMAIL'];
  const key = env['CLOUDFLARE_API_KEY'];
  const accountId = env['CLOUDFLARE_ACCOUNT_ID'];
  if (!email || !key || !accountId)
    fail('CLOUDFLARE_EMAIL / CLOUDFLARE_API_KEY / CLOUDFLARE_ACCOUNT_ID not set');
  if (!ACCOUNT_ID.test(accountId)) fail('CLOUDFLARE_ACCOUNT_ID malformed');
  return { email, key, accountId };
}

/**
 * Cloudflare client with the allow-list and a one-GraphQL-call-per-process budget.
 * `fetchImpl` is injectable for offline tests.
 */
export class CfClient {
  private graphqlCalls = 0;
  constructor(
    private readonly creds: CfCreds,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async call(req: CfRequest): Promise<unknown> {
    assertCfRequest(req);
    if (req.path === CF_GRAPHQL_PATH) {
      if (this.graphqlCalls >= 1) fail('only one GraphQL analytics read is allowed per run');
      this.graphqlCalls++;
    }
    const res = await this.fetchImpl(CF_API + req.path, {
      method: req.method,
      headers: {
        'X-Auth-Email': this.creds.email,
        'X-Auth-Key': this.creds.key,
        'content-type': 'application/json',
      },
      ...(req.body ? { body: JSON.stringify(req.body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) fail(`cloudflare ${req.method} ${req.path} -> HTTP ${res.status}`);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      fail(`cloudflare ${req.method} ${req.path} returned non-JSON`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// APPROVED-LIVE ledger: AI and OCR calls (<= 6 each per phase, <= 3 each per UTC day, AI planned
// 4 of 6 with a 5th only on a later UTC day) and sessions (5 per IP per UTC day; stop at 4 used).
export const CAPS = Object.freeze({
  aiPerPhase: 6,
  ocrPerPhase: 6,
  aiPerDay: 3,
  ocrPerDay: 3,
  aiPlanned: 4,
  sessionsPerDay: 5,
  sessionStopAt: 4,
});

export type LedgerKind = 'ai' | 'ocr' | 'session';

export interface LedgerEntry {
  kind: LedgerKind;
  day: string; // YYYY-MM-DD UTC
  at: string; // ISO
  label: string;
}

export interface LedgerState {
  version: 1;
  entries: LedgerEntry[];
}

export function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pure cap check. Returns null when allowed, otherwise the refusal reason. */
export function capRefusal(
  state: LedgerState,
  kind: LedgerKind,
  now: Date,
  opts: { allowFifthAi?: boolean } = {},
): string | null {
  const day = utcDay(now);
  const all = state.entries.filter((e) => e.kind === kind);
  const today = all.filter((e) => e.day === day).length;
  if (kind === 'session') {
    if (today >= CAPS.sessionStopAt)
      return `session ledger: ${today} of ${CAPS.sessionsPerDay} used today; stop at ${CAPS.sessionStopAt}, defer to the next UTC day`;
    return null;
  }
  const perPhase = kind === 'ai' ? CAPS.aiPerPhase : CAPS.ocrPerPhase;
  const perDay = kind === 'ai' ? CAPS.aiPerDay : CAPS.ocrPerDay;
  if (all.length >= perPhase) return `${kind} phase cap reached (${all.length} of ${perPhase})`;
  if (today >= perDay) return `${kind} UTC-day cap reached (${today} of ${perDay})`;
  if (kind === 'ai' && all.length >= CAPS.aiPlanned) {
    if (!opts.allowFifthAi)
      return `ai planned budget reached (${all.length} of ${CAPS.aiPlanned}); pass --allow-fifth-ai on a later UTC day`;
    const firstDay = all.map((e) => e.day).sort()[0];
    if (all.length > CAPS.aiPlanned) return 'only one call beyond the planned 4 is allowed';
    if (firstDay === day)
      return 'the 5th AI call is allowed only on a later UTC day than the first';
  }
  return null;
}

export function defaultScratchDir(): string {
  return process.env['LIVE_SCRATCH_DIR'] ?? join(homedir(), '.cache', 'aduin-transaction-live');
}

/** realpath of the deepest existing ancestor, with the missing remainder re-appended. */
function realish(p: string): string {
  const abs = resolve(p);
  let cur = abs;
  const rest: string[] = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) return abs;
    rest.unshift(basename(cur));
    cur = parent;
  }
  return join(realpathSync(cur), ...rest);
}

/** Refuse any scratch path inside the repository (cookies and ledgers never land in git). */
export function assertOutsideRepo(path: string, root = ROOT): string {
  if (!isAbsolute(path)) fail('scratch path must be absolute');
  const rel = relative(realish(root), realish(path));
  const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  if (!outside) fail('scratch path must be outside the repository');
  return resolve(path);
}

function ensurePrivateDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function writePrivate(file: string, text: string): void {
  ensurePrivateDir(dirname(file));
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, text, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 5_000;

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Exclusive lock file (O_EXCL create); retries briefly, breaks a lock older than 30 s. */
function withLock<T>(file: string, fn: () => T): T {
  const lock = `${file}.lock`;
  ensurePrivateDir(dirname(lock));
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx', 0o600));
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
          rmSync(lock, { force: true });
          continue;
        }
      } catch {
        continue; // lock vanished between open and stat
      }
      if (Date.now() > deadline) fail('ledger is locked by another script; retry shortly');
      sleepSync(25);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { force: true });
  }
}

function readLedger(file: string): LedgerState {
  const state = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as LedgerState)
    : { version: 1 as const, entries: [] };
  if (state.version !== 1 || !Array.isArray(state.entries)) fail('ledger file is malformed');
  return state;
}

/**
 * File-backed ledger (mode 600, outside the repo). It counts only runs of these scripts: app
 * sessions opened by hand in a browser or by other tools are NOT recorded, so the operator must
 * add those to the daily budget by judgement.
 */
export class Ledger {
  readonly file: string;
  private state: LedgerState;

  constructor(
    dir = defaultScratchDir(),
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.file = join(assertOutsideRepo(dir), 'live-ledger.json');
    this.state = readLedger(this.file);
  }

  snapshot(): LedgerState {
    return { version: 1, entries: [...this.state.entries] };
  }

  counts(kind: LedgerKind): { phase: number; today: number } {
    const day = utcDay(this.clock());
    const all = this.state.entries.filter((e) => e.kind === kind);
    return { phase: all.length, today: all.filter((e) => e.day === day).length };
  }

  /** Claim one unit or throw with the refusal reason. Claims are written before the call is made. */
  claim(kind: LedgerKind, label: string, opts: { allowFifthAi?: boolean } = {}): void {
    withLock(this.file, () => {
      // Re-read under the lock so a concurrent script's claims are counted.
      this.state = readLedger(this.file);
      const now = this.clock();
      const refusal = capRefusal(this.state, kind, now, opts);
      if (refusal) fail(refusal);
      this.state.entries.push({ kind, day: utcDay(now), at: now.toISOString(), label });
      writePrivate(this.file, JSON.stringify(this.state, null, 2));
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Stop conditions over Worker responses.
export interface Observation {
  status: number;
  /** Parsed JSON body or one NDJSON frame. */
  body?: unknown;
}

function get(o: unknown, ...path: string[]): unknown {
  let cur = o;
  for (const p of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Returns a stop reason or null. Stops on: any 429 (unless expected), a `budget_cap` code or a
 * breaker reason, a `rate_limited` code (unless a 429 is expected), a closed global quota, and a
 * result frame whose served `model` is not a `:free` model. Error details come in two shapes:
 * HTTP bodies `{error:{code,reason}}` and streamed frames `{t:'error',code,reason}` (frames.ts).
 * Frames carry no cost field; the `:free` model check is the spend guard.
 */
export function stopReason(obs: Observation, opts: { expect429?: boolean } = {}): string | null {
  if (obs.status === 429 && !opts.expect429) return 'HTTP 429 received';
  const frames = Array.isArray(obs.body) ? obs.body : [obs.body];
  for (const f of frames) {
    const streamed = get(f, 't') === 'error';
    const code = streamed ? get(f, 'code') : get(f, 'error', 'code');
    const reason = streamed ? get(f, 'reason') : get(f, 'error', 'reason');
    if (code === 'budget_cap') return 'budget cap / breaker open';
    if (typeof reason === 'string' && /breaker/i.test(reason)) return 'breaker open';
    if (code === 'rate_limited' && !opts.expect429) return 'rate_limited received';
    if (get(f, 'global_ok') === false) return 'global quota closed (breaker or global cap)';
    if (get(f, 't') === 'result') {
      const model = get(f, 'model');
      if (typeof model !== 'string' || !model.endsWith(':free'))
        return `served model ${typeof model === 'string' ? model : '(missing)'} is not :free`;
    }
  }
  return null;
}

/** Parse an NDJSON body into frames, skipping blank lines; malformed lines throw. */
export function parseNdjson(text: string): unknown[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as unknown);
}

// ---------------------------------------------------------------------------------------------
// Secret hygiene.
const SECRET_ENV =
  /OPENROUTER|TURNSTILE|COOKIE_SIGNING|CLOUDFLARE_API|CF_API|API_KEY|SECRET|TOKEN/i;

/** Replace any secret env value and any aduin cookie value in `text` with [redacted]. */
export function redact(
  text: string,
  extra: readonly string[] = [],
  env: NodeJS.ProcessEnv = process.env,
): string {
  let out = text;
  const values = [
    ...extra,
    ...Object.entries(env)
      .filter(([k, v]) => SECRET_ENV.test(k) && typeof v === 'string' && v.length >= 6)
      .map(([, v]) => v as string),
  ];
  for (const v of values) if (v) out = out.split(v).join('[redacted]');
  out = out.replace(
    new RegExp(`${COOKIE_NAME.replace(/[-_]/g, '[-_]')}=[^;\\s"']+`, 'g'),
    `${COOKIE_NAME}=[redacted]`,
  );
  return out;
}

export function log(prefix: string, msg: string, secrets: readonly string[] = []): void {
  console.log(`${prefix}: ${redact(msg, secrets)}`);
}

/** Cookie handoff: in-process string, or a mode-600 file outside the repo. */
export function writeCookieFile(path: string, cookieValue: string): string {
  const file = assertOutsideRepo(path);
  if (!cookieValue) fail('no cookie value to hand over');
  writePrivate(file, JSON.stringify({ name: COOKIE_NAME, value: cookieValue }));
  return file;
}

export function readCookieFile(path: string): string {
  const file = assertOutsideRepo(path);
  if (!existsSync(file)) fail('cookie file not found');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; value?: unknown };
  if (parsed.name !== COOKIE_NAME || typeof parsed.value !== 'string' || !parsed.value)
    fail('cookie file is malformed');
  return parsed.value;
}

export function deleteCookieFile(path: string): void {
  rmSync(assertOutsideRepo(path), { force: true });
}

/** Tiny `--flag value` / `--flag` parser with an allow-list; unknown flags throw. */
export function parseFlags(
  argv: readonly string[],
  valued: readonly string[],
  booleans: readonly string[],
): { values: Record<string, string>; bools: Set<string> } {
  const values: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    const name = a.replace(/^--/, '');
    if (!a.startsWith('--')) fail(`unexpected argument ${JSON.stringify(a)}`);
    if (booleans.includes(name)) bools.add(name);
    else if (valued.includes(name)) {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) fail(`--${name} needs a value`);
      values[name] = v;
    } else
      fail(
        `unknown flag --${name} (allowed: ${[...valued, ...booleans].map((f) => `--${f}`).join(', ')})`,
      );
  }
  return { values, bools };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
