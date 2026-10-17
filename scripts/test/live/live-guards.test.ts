import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyticsRequest,
  ANALYTICS_TEMPLATES,
  assertCfRequest,
  assertLiveBase,
  assertOutsideRepo,
  capRefusal,
  CfClient,
  COOKIE_NAME,
  Ledger,
  type LedgerState,
  liveUrl,
  readCookieFile,
  redact,
  ROOT,
  stopReason,
  writeCookieFile,
} from '../../src/live/common';

const ACCT = 'a'.repeat(32);
const LIVE = 'https://aduin-transaction-web.giathaowork.workers.dev';
// The protected zone is never written literally; build a look-alike from parts.
const someZoneHost = ['example', 'com'].join('.');

let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
function scratch(): string {
  const d = mkdtempSync(join(tmpdir(), 'aduin-live-'));
  dirs.push(d);
  return d;
}

describe('live host allow-list', () => {
  it('accepts the live workers.dev origin', () => {
    expect(assertLiveBase(LIVE)).toBe(LIVE);
    expect(assertLiveBase(`${LIVE}/`)).toBe(LIVE);
  });
  it.each([
    ['http', LIVE.replace('https', 'http')],
    ['other workers.dev', 'https://evil.giathaowork.workers.dev'],
    ['other subdomain', 'https://aduin-transaction-web.other.workers.dev'],
    ['custom domain', `https://aduin.${someZoneHost}`],
    ['port', `${LIVE}:8443`],
    ['path', `${LIVE}/api`],
    ['credentials', LIVE.replace('https://', 'https://u:p@')],
  ])('rejects %s', (_n, url) => {
    expect(() => assertLiveBase(url)).toThrow();
  });
  it('liveUrl keeps requests on the origin', () => {
    expect(liveUrl(LIVE, '/api/quota')).toBe(`${LIVE}/api/quota`);
    expect(() => liveUrl(LIVE, '//evil.workers.dev/x')).toThrow();
  });
});

describe('cloudflare allow-list', () => {
  it('allows REST under /accounts/{id}', () => {
    expect(() =>
      assertCfRequest({ method: 'GET', path: `/client/v4/accounts/${ACCT}/workers/scripts` }),
    ).not.toThrow();
    expect(() =>
      assertCfRequest({
        method: 'POST',
        path: `/client/v4/accounts/${ACCT}/challenges/widgets`,
        body: {},
      }),
    ).not.toThrow();
  });
  it.each([
    '/client/v4/zones',
    '/client/v4/zones/abc/dns_records',
    `/client/v4/accounts/${ACCT}/../../zones`,
    '/client/v4/user',
    '/client/v4/accounts',
    `/client/v4/accounts/${ACCT}/zone-settings`,
  ])('rejects %s', (path) => {
    expect(() => assertCfRequest({ method: 'GET', path })).toThrow();
  });
  it('allows only the accountTag-only templates on graphql', () => {
    for (const q of Object.values(ANALYTICS_TEMPLATES)) {
      expect(q).toContain('accountTag');
      expect(q.toLowerCase()).not.toContain('zone');
    }
    const req = analyticsRequest('d1RowsWritten', {
      accountTag: ACCT,
      since: '2026-10-17T00:00:00Z',
      until: '2026-10-17T01:00:00Z',
      target: 'db-1',
    });
    expect(() => assertCfRequest(req)).not.toThrow();
  });
  it('rejects any graphql query mentioning zones, custom queries, GET and mutations', () => {
    const vars = { accountTag: ACCT };
    const zoneQuery =
      'query { viewer { zones(filter: {zoneTag: "x"}) { httpRequests1dGroups { sum { requests } } } } }';
    expect(() =>
      assertCfRequest({
        method: 'POST',
        path: '/client/v4/graphql',
        body: { query: zoneQuery, variables: vars },
      }),
    ).toThrow(/zone/);
    expect(() =>
      assertCfRequest({
        method: 'POST',
        path: '/client/v4/graphql',
        body: { query: 'query { viewer { accounts { id } } }', variables: vars },
      }),
    ).toThrow();
    expect(() =>
      assertCfRequest({
        method: 'POST',
        path: '/client/v4/graphql',
        body: { query: 'mutation { x }', variables: vars },
      }),
    ).toThrow();
    expect(() => assertCfRequest({ method: 'GET', path: '/client/v4/graphql' })).toThrow();
    const t = ANALYTICS_TEMPLATES.workerCpu;
    expect(() =>
      assertCfRequest({
        method: 'POST',
        path: '/client/v4/graphql',
        body: { query: t, variables: { accountTag: ACCT, zoneTag: 'x' } },
      }),
    ).toThrow(/zone/);
  });
  it('client sends at most one graphql call per run and never a zone path', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      return new Response('{"data":{}}', { status: 200 });
    }) as unknown as typeof fetch;
    const c = new CfClient({ email: 'x@y.z', key: 'k', accountId: ACCT }, fake);
    const req = analyticsRequest('workerCpu', {
      accountTag: ACCT,
      since: '2026-10-17T00:00:00Z',
      until: '2026-10-17T01:00:00Z',
      target: 'aduin-transaction-web',
    });
    await c.call(req);
    await expect(c.call(req)).rejects.toThrow(/one GraphQL/);
    await expect(c.call({ method: 'GET', path: '/client/v4/zones' })).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
});

describe('APPROVED-LIVE ledger', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const mk = (kind: 'ai' | 'ocr' | 'session', day: string, n: number): LedgerState['entries'] =>
    Array.from({ length: n }, () => ({ kind, day, at: `${day}T00:00:00Z`, label: 't' }));
  it('caps AI and OCR at 3 per UTC day', () => {
    expect(capRefusal({ version: 1, entries: mk('ai', '2026-10-17', 2) }, 'ai', now)).toBeNull();
    expect(capRefusal({ version: 1, entries: mk('ai', '2026-10-17', 3) }, 'ai', now)).toMatch(
      /UTC-day/,
    );
    expect(capRefusal({ version: 1, entries: mk('ocr', '2026-10-17', 3) }, 'ocr', now)).toMatch(
      /UTC-day/,
    );
  });
  it('caps AI at the planned 4 unless a 5th on a later day, and never above 6', () => {
    const four = [...mk('ai', '2026-10-16', 3), ...mk('ai', '2026-10-17', 1)];
    expect(capRefusal({ version: 1, entries: four }, 'ai', now)).toMatch(/planned/);
    expect(capRefusal({ version: 1, entries: four }, 'ai', now, { allowFifthAi: true })).toBeNull();
    const five = [...four, ...mk('ai', '2026-10-17', 1)];
    expect(
      capRefusal({ version: 1, entries: five }, 'ai', now, { allowFifthAi: true }),
    ).not.toBeNull();
    expect(capRefusal({ version: 1, entries: mk('ocr', '2026-10-15', 6) }, 'ocr', now)).toMatch(
      /phase cap/,
    );
  });
  it('session ledger stops at 4 of 5 per UTC day', () => {
    expect(
      capRefusal({ version: 1, entries: mk('session', '2026-10-17', 3) }, 'session', now),
    ).toBeNull();
    expect(
      capRefusal({ version: 1, entries: mk('session', '2026-10-17', 4) }, 'session', now),
    ).toMatch(/stop at 4/);
    expect(
      capRefusal({ version: 1, entries: mk('session', '2026-10-16', 4) }, 'session', now),
    ).toBeNull();
  });
  it('persists claims mode 600 outside the repo and refuses over cap', () => {
    const d = scratch();
    const l = new Ledger(d, () => now);
    for (let i = 0; i < 4; i++) l.claim('session', `s${i}`);
    expect(() => l.claim('session', 'x')).toThrow(/stop at 4/);
    expect(statSync(l.file).mode & 0o777).toBe(0o600);
    expect(new Ledger(d, () => now).counts('session')).toEqual({ phase: 4, today: 4 });
    expect(() => new Ledger(join(ROOT, 'tmp-ledger'))).toThrow(/outside the repository/);
  });
});

describe('stop conditions', () => {
  it('stops on cost > 0, any 429, breaker and closed global quota', () => {
    expect(stopReason({ status: 200, body: [{ usage: { cost: 0 } }] })).toBeNull();
    expect(stopReason({ status: 200, body: [{ type: 'x' }, { usage: { cost: 0.0001 } }] })).toMatch(
      /cost/,
    );
    expect(stopReason({ status: 429, body: {} })).toMatch(/429/);
    expect(
      stopReason({ status: 429, body: { error: { code: 'rate_limited' } } }, { expect429: true }),
    ).toBeNull();
    expect(stopReason({ status: 503, body: { error: { code: 'budget_cap' } } })).toMatch(/breaker/);
    expect(
      stopReason({
        status: 503,
        body: { error: { code: 'upstream_failed', reason: 'breaker_open' } },
      }),
    ).toMatch(/breaker/);
    expect(stopReason({ status: 200, body: { ai: 1, ocr_pages: 1, global_ok: false } })).toMatch(
      /global/,
    );
  });
});

describe('secret hygiene', () => {
  it('redacts secret env values and the workspace cookie', () => {
    const env = { CLOUDFLARE_API_KEY: 'abcdef123456', PATH: '/bin' };
    const out = redact(`key abcdef123456 cookie ${COOKIE_NAME}=v1.sig; path /bin`, [], env);
    expect(out).not.toContain('abcdef123456');
    expect(out).not.toContain('v1.sig');
    expect(out).toContain('/bin');
  });
  it('cookie handoff file is mode 600, outside the repo, round-trips', () => {
    const f = join(scratch(), 'cookie.json');
    writeCookieFile(f, 'value.sig');
    expect(statSync(f).mode & 0o777).toBe(0o600);
    expect(readCookieFile(f)).toBe('value.sig');
    expect(readFileSync(f, 'utf8')).toContain(COOKIE_NAME);
    expect(() => writeCookieFile(join(ROOT, 'cookie.json'), 'v')).toThrow(/outside/);
    expect(() => assertOutsideRepo('relative/path')).toThrow(/absolute/);
  });
});
