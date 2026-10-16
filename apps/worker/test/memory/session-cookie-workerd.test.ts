// AC56, AC39: POST /api/session in workerd: one `__Host-aduin_v` cookie carrying v + w + a (+ t
// preserved) with exp = workspace expiry (30 d); Turnstile enforced iff TURNSTILE_SECRET is set;
// session_new per-IP and global caps; read-only demo degrade; cookie helper vectors in workerd.
import { env } from 'cloudflare:test';
import { limits, signCookie, verifyCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { ipHash, VISITOR_COOKIE } from '../../src/limits/visitor';
import { SESSION_CAPS } from '../../src/platform/index';
import { TS_FAIL, TS_PASS } from '../fakes/turnstile-stub';
import {
  call,
  COOKIE_KEY,
  cookieOf,
  cookieValue,
  DAY_MS,
  fpOf,
  KEYS,
  lookup,
  makeMem,
  newRun,
  decide,
} from './memory-harness';

const post = (h: ReturnType<typeof makeMem>, body: unknown, o: Parameters<typeof call>[4] = {}) =>
  call(h, 'POST', '/api/session', body, o);

describe('session-cookie-workerd (AC56, AC39)', () => {
  test('should keep v and t when the session re-signs the cookie with w and a', async () => {
    const h = makeMem();
    const nowS = Math.floor(h.clock.now / 1000);
    const t = h.clock.now - 1000;
    const prior = await signCookie(
      { v: 'keepme_v', iat: nowS - 10, exp: nowS + 3600, kid: 'k1', t },
      COOKIE_KEY,
    );
    const r = await post(
      h,
      { analyst_name: 'Fay (simulated analyst)' },
      { cookie: `${VISITOR_COOKIE}=${prior}`, ip: '192.0.2.10' },
    );
    expect(r.status).toBe(200);
    const sc = r.res.headers.get('set-cookie')!;
    expect(sc).toMatch(/^__Host-aduin_v=/);
    expect(sc).toMatch(/; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
    const v = await verifyCookie(
      cookieValue(cookieOf(r.res)!),
      KEYS,
      Math.floor(h.clock.now / 1000),
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.claims).toMatchObject({
      v: 'keepme_v',
      t,
      w: r.body.workspace_id,
      a: r.body.analyst_id,
      kid: 'k1',
    });
    expect(v.claims.exp).toBe(Math.floor(r.body.expires_at / 1000));
    expect(r.body.expires_at - h.clock.now).toBe(limits.sandboxRetentionDays * DAY_MS);
    expect(new TextEncoder().encode(cookieValue(cookieOf(r.res)!)).byteLength).toBeLessThanOrEqual(
      limits.cookieMaxBytes,
    );
    const row = await env.DB.prepare('SELECT kind, expires_at FROM workspace WHERE id = ?1')
      .bind(r.body.workspace_id)
      .first();
    expect(row).toEqual({ kind: 'sandbox', expires_at: r.body.expires_at });
  });

  test('Turnstile is enforced iff TURNSTILE_SECRET is configured (fail closed)', async () => {
    const countIp = async () =>
      (
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM quota_counter WHERE scope = 'session_new' AND key LIKE 'snew|ip|%'",
        ).first<{ n: number }>()
      )?.n ?? 0;
    const before = await countIp();
    const off = makeMem();
    expect((await post(off, { analyst_name: 'A' }, { ip: '192.0.2.20' })).status).toBe(200);
    expect(off.ts.calls).toBe(0);
    const on = makeMem({ env: { TURNSTILE_SECRET: TS_PASS } });
    const missing = await post(on, { analyst_name: 'A' }, { ip: '192.0.2.21' });
    expect(missing.status).toBe(401);
    expect(missing.body.error).toMatchObject({
      code: 'invalid_session',
      reason: 'turnstile_missing',
    });
    const pass = await post(
      on,
      { analyst_name: 'A', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' },
      { ip: '192.0.2.22' },
    );
    expect(pass.status).toBe(200);
    expect(on.ts.calls).toBe(1);
    const v = await verifyCookie(
      cookieValue(cookieOf(pass.res)!),
      KEYS,
      Math.floor(on.clock.now / 1000),
    );
    expect(v.ok && v.claims.t).toBe(on.clock.now);
    const fail = makeMem({ env: { TURNSTILE_SECRET: TS_FAIL } });
    const f = await post(
      fail,
      { analyst_name: 'A', turnstile: 'XXXX.DUMMY.TOKEN.XXXX' },
      { ip: '192.0.2.23' },
    );
    expect(f.status).toBe(401);
    expect(f.body.error.reason).toBe('turnstile_failed');
    expect((await countIp()) - before).toBe(2); // only the two allowed sessions claimed
  });

  test('session_new: per-IP cap gives 429; the global cap degrades to the read-only demo', async () => {
    const h = makeMem();
    const ip = '192.0.2.30';
    for (let i = 0; i < SESSION_CAPS.perIpPerDay; i++)
      expect((await post(h, { analyst_name: 'A' }, { ip })).status).toBe(200);
    const over = await post(h, { analyst_name: 'A' }, { ip });
    expect(over.status).toBe(429);
    expect(over.body.error).toMatchObject({ code: 'rate_limited', reason: 'session_limit' });
    // global cap reached -> read-only demo (no workspace created)
    const day = new Date(h.clock.now).toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO quota_counter (scope, key, window, count, updated_at) VALUES ('session_new', 'snew|g', ?1, ?2, 0) ON CONFLICT(scope, key, window) DO UPDATE SET count = excluded.count",
    )
      .bind(day, SESSION_CAPS.globalPerDay)
      .run();
    const wsBefore = await env.DB.prepare('SELECT COUNT(*) AS n FROM workspace').first<{
      n: number;
    }>();
    const ro = await post(h, { analyst_name: 'A' }, { ip: '192.0.2.31' });
    await env.DB.prepare(
      "DELETE FROM quota_counter WHERE scope = 'session_new' AND key = 'snew|g'",
    ).run();
    expect(ro.status).toBe(200);
    expect(ro.body).toMatchObject({ read_only: true, kind: 'visitor', workspace_id: 'ws_demo' });
    expect(
      (await env.DB.prepare('SELECT COUNT(*) AS n FROM workspace').first<{ n: number }>())?.n,
    ).toBe(wsBefore?.n);
    const v = await verifyCookie(
      cookieValue(cookieOf(ro.res)!),
      KEYS,
      Math.floor(h.clock.now / 1000),
    );
    expect(v.ok && v.claims.w).toBeUndefined();
    const roSession = { cookie: cookieOf(ro.res)!, workspaceId: 'ws_demo', analystId: 'ro' };
    const seedFp = fpOf(
      'firm-x',
      'defined_term_issue',
      'The Investor shall subscribe for Units in the Fund as set out in Part B.',
    );
    expect((await lookup(h, roSession, 'firm-x', [seedFp])).body.decisions).toHaveLength(1);
    const w = await call(
      h,
      'POST',
      '/api/runs',
      {
        client_op_id: 'op-ro-12345',
        doc_name: 'd',
        doc_hash: seedFp,
        law_firm_id: 'firm-x',
        settings_hash: seedFp,
      },
      { cookie: roSession.cookie },
    );
    expect(w.status).toBe(403);
    expect(w.body.error.code).toBe('read_only_demo');
    // review L1: the per-IP claim of the degraded request is NOT refunded (count stays 1)
    const hash = await ipHash(
      new Request('https://x', { headers: { 'cf-connecting-ip': '192.0.2.31' } }),
      COOKIE_KEY,
      h.clock.now,
    );
    const ipRow = await env.DB.prepare(
      "SELECT count FROM quota_counter WHERE scope = 'session_new' AND key = ?1",
    )
      .bind(`snew|ip|${hash}`)
      .first<{ count: number }>();
    expect(ipRow?.count).toBe(1);
  });

  test('memory routes never mint: a request without a cookie gets 401 and no Set-Cookie', async () => {
    const h = makeMem();
    const s = await (async () => {
      const r = await post(h, { analyst_name: 'A' }, { ip: '192.0.2.40' });
      return {
        cookie: cookieOf(r.res)!,
        workspaceId: r.body.workspace_id,
        analystId: r.body.analyst_id,
      };
    })();
    const run = await newRun(h, s);
    for (const [m, p, b] of [
      [
        'POST',
        '/api/memory/lookup',
        { law_firm_id: 'firm-x', fingerprints: [fpOf('firm-x', 'ambiguity', 'q')] },
      ],
      ['POST', '/api/decisions', {}],
      ['GET', '/api/rules?law_firm_id=firm-x', undefined],
      ['GET', '/api/memory/firm?law_firm_id=firm-x', undefined],
      ['GET', '/api/audit?limit=1', undefined],
      ['GET', '/api/export', undefined],
      ['POST', `/api/runs/${run}/findings`, { client_op_id: 'op-12345678', findings: [] }],
    ] as const) {
      const r = await call(h, m, p, b);
      expect(r.status, p).toBe(401);
      expect(r.res.headers.get('set-cookie'), p).toBeNull();
    }
    expect((await decide(h, s, { runId: run, quote: 'Still works with the cookie.' })).status).toBe(
      200,
    );
  });

  test('cookie helper vectors in workerd: sign/verify round trip, tamper, expiry, unknown kid', async () => {
    const now = 1_800_000_000;
    const claims = {
      v: 'vis_abc123',
      w: 'w_1',
      a: 'an_1',
      iat: now - 10,
      exp: now + 3600,
      kid: 'k1',
    };
    const c = await signCookie(claims, COOKIE_KEY);
    expect(await verifyCookie(c, KEYS, now)).toEqual({ ok: true, claims });
    expect(await verifyCookie(c, KEYS, now + 3600)).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyCookie(c, { k2: COOKIE_KEY }, now)).toEqual({
      ok: false,
      reason: 'unknown_kid',
    });
    const [p, s] = c.split('.') as [string, string];
    expect(
      (await verifyCookie(`${p}.${s.slice(0, -1)}${s.endsWith('A') ? 'B' : 'A'}`, KEYS, now)).ok,
    ).toBe(false);
  });
});
