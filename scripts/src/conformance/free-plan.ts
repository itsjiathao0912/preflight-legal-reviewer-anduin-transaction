// `pnpm --filter @aduin/scripts conformance:free-plan` — live free-plan conformance (AC39, AC40, D4).
//
// Sections (run in this order; select with --section):
//   matrix  AC39 reject-before-claim abuse cases against the live Worker. No case can reach
//           OpenRouter: every request is malformed, unauthenticated or oversized. `GET /api/quota`
//           is read before and after and must be unchanged (nothing claimed).
//   limits  AC40: quota shape, then ONE over-limit safe failure: cheap `GET /api/quota` calls until
//           the in-isolate pre-limit answers 429 `rate_limited` (bounded at 40 requests). That 429
//           is the only expected one; any other 429 stops the run.
//   burst   D4: bounded memory writes (`POST /api/runs`, no upstream) with the workspace cookie
//           handed over by `probe:live-session` (--cookie-file, mode 600, outside the repo), then
//           ONE accountTag-only GraphQL read of D1 `rowsWritten` (needs CLOUDFLARE_* env and
//           --d1-id). No cookie => named residual R2 (exit 3, gate CONDITIONAL). No AI call and no
//           timing probe here; that lives in `probe:live-ai`.
//
// Flags: --section matrix|limits|burst|all (default all), --base <origin> (allow-listed),
//        --cookie-file <abs path>, --writes <n> (burst, default 12, max 40), --d1-id <uuid-ish>,
//        --pace-ms <n> (default 2500 => 24 req/min, under 30/min and 6 AI/min).
// Exit:  0 pass, 1 fail or stop condition, 2 bad args, 3 residual (no cookie for burst).
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  analyticsRequest,
  CfClient,
  cfCredsFromEnv,
  COOKIE_NAME,
  liveBase,
  liveUrl,
  LiveGuardError,
  log,
  parseFlags,
  readCookieFile,
  sleep,
  stopReason,
  utcDay,
} from '../live/common';

const P = 'conformance:free-plan';

export interface HttpResult {
  status: number;
  body: unknown;
  headers: Headers;
}

export type Http = (path: string, init?: RequestInit) => Promise<HttpResult>;

export function makeHttp(base: string, fetchImpl: typeof fetch = fetch, cookie?: string): Http {
  return async (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) headers.set('cookie', `${COOKIE_NAME}=${cookie}`);
    const res = await fetchImpl(liveUrl(base, path), { ...init, headers, redirect: 'manual' });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return { status: res.status, body, headers: res.headers };
  };
}

export interface MatrixCase {
  id: string;
  path: string;
  init: RequestInit;
  /** Acceptable statuses: all are rejections before any claim. */
  expect: readonly number[];
}

const JPEG_PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), randomBytes(64)]).toString('base64');

export function matrixCases(): MatrixCase[] {
  const json = { 'content-type': 'application/json' };
  return [
    {
      id: 'ai-no-session-no-token',
      path: '/api/ai',
      init: { method: 'POST', headers: json, body: '{}' },
      expect: [400, 401, 403],
    },
    {
      id: 'ai-wrong-content-type',
      path: '/api/ai',
      init: { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' },
      expect: [400, 403, 415],
    },
    {
      id: 'ai-oversized-body',
      path: '/api/ai',
      init: {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ pad: 'x'.repeat(140 * 1024) }),
      },
      expect: [403, 413],
    },
    {
      id: 'ocr-pdf-labelled-image',
      path: '/api/ocr',
      init: {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ mime: 'image/jpeg', data_b64: JPEG_PDF }),
      },
      expect: [400, 403, 415],
    },
    {
      id: 'memory-write-forged-cookie',
      path: '/api/decisions',
      init: {
        method: 'POST',
        headers: { ...json, cookie: `${COOKIE_NAME}=forged.forged.forged` },
        body: '{}',
      },
      expect: [400, 401, 403],
    },
    {
      id: 'memory-write-no-cookie',
      path: '/api/runs',
      init: { method: 'POST', headers: json, body: '{}' },
      expect: [400, 401, 403],
    },
    {
      id: 'unknown-route',
      path: '/api/does-not-exist',
      init: { method: 'GET' },
      expect: [404, 405],
    },
  ];
}

function hasErrorShape(body: unknown): boolean {
  const e = (body as { error?: { code?: unknown } } | null)?.error;
  return typeof e?.code === 'string';
}

export async function runMatrix(http: Http, paceMs: number): Promise<string[]> {
  const failures: string[] = [];
  const before = await http('/api/quota');
  const stop0 = stopReason(before);
  if (stop0) return [`stop before matrix: ${stop0}`];
  for (const c of matrixCases()) {
    await sleep(paceMs);
    const r = await http(c.path, c.init);
    const stop = stopReason(r);
    if (stop) return [...failures, `stop at ${c.id}: ${stop}`];
    const ok =
      c.expect.includes(r.status) &&
      (r.status === 404 || r.status === 405 || hasErrorShape(r.body));
    log(P, `matrix ${c.id}: HTTP ${r.status} ${ok ? 'ok' : 'UNEXPECTED'}`);
    if (!ok)
      failures.push(
        `${c.id}: HTTP ${r.status}, expected one of ${c.expect.join('/')} with an error body`,
      );
  }
  await sleep(paceMs);
  const after = await http('/api/quota');
  if (JSON.stringify(after.body) !== JSON.stringify(before.body))
    failures.push('quota changed across the matrix (something was claimed)');
  else log(P, 'matrix: quota unchanged (reject-before-claim holds)');
  return failures;
}

export async function runLimits(http: Http, paceMs: number, maxRequests = 40): Promise<string[]> {
  const q = await http('/api/quota');
  const stop = stopReason(q);
  if (stop) return [`stop: ${stop}`];
  const b = q.body as Record<string, unknown>;
  const failures: string[] = [];
  if (
    q.status !== 200 ||
    typeof b?.['global_ok'] !== 'boolean' ||
    b?.['ai'] === undefined ||
    b?.['ocr_pages'] === undefined
  )
    failures.push(`quota shape unexpected (HTTP ${q.status})`);
  await sleep(paceMs);
  for (let i = 1; i <= maxRequests; i++) {
    const r = await http('/api/quota');
    if (r.status === 429) {
      const e = (r.body as { error?: { code?: string; retry_after_s?: number } }).error;
      const safe =
        e?.code === 'rate_limited' && r.headers.get('cache-control')?.includes('no-store') === true;
      log(
        P,
        `limits: over-limit safe failure after ${i} requests: ${safe ? 'ok' : 'UNEXPECTED shape'}`,
      );
      if (!safe) failures.push('over-limit 429 lacks rate_limited code or no-store');
      return failures;
    }
    const s = stopReason(r);
    if (s) return [...failures, `stop: ${s}`];
  }
  failures.push(`no 429 after ${maxRequests} requests (pre-limit not observed)`);
  return failures;
}

export function runBody(i: number): Record<string, unknown> {
  const hex = (n: number) => randomBytes(n).toString('hex');
  return {
    client_op_id: `d4-burst-${randomUUID()}`,
    doc_name: `d4-burst-${i}`,
    doc_hash: hex(32),
    law_firm_id: null,
    settings_hash: hex(32),
  };
}

export async function runBurst(
  http: Http,
  writes: number,
  paceMs: number,
): Promise<{ failures: string[]; ok: number }> {
  let ok = 0;
  for (let i = 0; i < writes; i++) {
    const r = await http('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(runBody(i)),
    });
    const stop = stopReason(r);
    if (stop) return { failures: [`stop at write ${i + 1}: ${stop}`], ok };
    if (r.status !== 200) return { failures: [`write ${i + 1}: HTTP ${r.status}`], ok };
    ok++;
    await sleep(paceMs);
  }
  log(P, `burst: ${ok} run writes accepted`);
  return { failures: [], ok };
}

/** Sum rowsWritten; throws when GraphQL reports errors or returns no account (never a silent 0). */
export function sumRowsWritten(resp: unknown): number {
  const r = resp as {
    errors?: unknown;
    data?: { viewer?: { accounts?: unknown } } | null;
  } | null;
  if (Array.isArray(r?.errors) && r.errors.length > 0)
    throw new LiveGuardError(`analytics GraphQL returned ${r.errors.length} error(s)`);
  const accts = r?.data?.viewer?.accounts;
  if (!Array.isArray(accts) || accts.length === 0)
    throw new LiveGuardError('analytics GraphQL returned no account data');
  let total = 0;
  for (const a of accts as Array<{
    d1AnalyticsAdaptiveGroups?: Array<{ sum?: { rowsWritten?: number } }>;
  }>)
    for (const g of a.d1AnalyticsAdaptiveGroups ?? []) total += g.sum?.rowsWritten ?? 0;
  return total;
}

async function main(): Promise<number> {
  const f = parseFlags(
    process.argv.slice(2),
    ['section', 'base', 'cookie-file', 'writes', 'd1-id', 'pace-ms'],
    [],
  );
  const section = f.values['section'] ?? 'all';
  if (!['matrix', 'limits', 'burst', 'all'].includes(section))
    throw new LiveGuardError('--section must be matrix|limits|burst|all');
  const base = liveBase(f.values['base']);
  const paceMs = Number(f.values['pace-ms'] ?? 2500);
  if (!Number.isInteger(paceMs) || paceMs < 2000)
    throw new LiveGuardError('--pace-ms must be an integer >= 2000');
  const writes = Number(f.values['writes'] ?? 12);
  if (!Number.isInteger(writes) || writes < 1 || writes > 40)
    throw new LiveGuardError('--writes must be 1..40');

  const failures: string[] = [];
  const http = makeHttp(base);
  if (section === 'matrix' || section === 'all') failures.push(...(await runMatrix(http, paceMs)));
  if (failures.length === 0 && (section === 'limits' || section === 'all'))
    failures.push(...(await runLimits(http, 1)));
  if (failures.length === 0 && (section === 'burst' || section === 'all')) {
    const cookieFile = f.values['cookie-file'];
    if (!cookieFile) {
      log(
        P,
        'RESIDUAL R2: no session cookie handed over by probe:live-session; D4 burst skipped (gate CONDITIONAL, backlog stub)',
      );
      return failures.length ? 1 : 3;
    }
    const cookie = readCookieFile(cookieFile);
    // pre-limit window from the limits section: wait one minute before writing.
    if (section === 'all') await sleep(61_000);
    const since = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const r = await runBurst(makeHttp(base, fetch, cookie), writes, paceMs);
    failures.push(...r.failures);
    const d1 = f.values['d1-id'];
    if (r.failures.length === 0 && d1) {
      await sleep(60_000); // analytics lag
      const creds = cfCredsFromEnv();
      const until = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      const resp = await new CfClient(creds).call(
        analyticsRequest('d1RowsWritten', {
          accountTag: creds.accountId,
          since,
          until,
          target: d1,
        }),
      );
      const rows = sumRowsWritten(resp);
      log(
        P,
        `burst: rowsWritten ${rows} over ${r.ok} writes on ${utcDay(new Date())} (source: GraphQL d1AnalyticsAdaptiveGroups); per write ${(rows / Math.max(1, r.ok)).toFixed(1)}`,
      );
    } else if (!d1)
      log(P, 'burst: --d1-id not given; rowsWritten not read (alternative: wrangler d1 insights)');
  }
  for (const x of failures) log(P, `FAIL ${x}`);
  log(P, failures.length ? `${failures.length} failure(s)` : 'OK');
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(`${P}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(e instanceof LiveGuardError ? 2 : 1);
    },
  );
}
