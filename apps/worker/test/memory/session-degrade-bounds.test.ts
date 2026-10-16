// Review L1 + L6 (fix cycle 1): over the global sandbox cap, (L1) the degrade path keeps the
// per-IP claim so one IP cannot loop POST /api/session without bound, and (L6) a browser that
// already holds a live sandbox cookie keeps that sandbox instead of being downgraded to 'ro'.
import { env } from 'cloudflare:test';
import { verifyCookie } from '@aduin/core';
import { afterEach, describe, expect, test } from 'vitest';
import { SESSION_CAPS } from '../../src/platform/index';
import { call, cookieOf, cookieValue, KEYS, makeMem } from './memory-harness';

const post = (h: ReturnType<typeof makeMem>, o: Parameters<typeof call>[4] = {}) =>
  call(h, 'POST', '/api/session', { analyst_name: 'A' }, o);

async function fillGlobal(nowMs: number): Promise<void> {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  await env.DB.prepare(
    "INSERT INTO quota_counter (scope, key, window, count, updated_at) VALUES ('session_new', 'snew|g', ?1, ?2, 0) ON CONFLICT(scope, key, window) DO UPDATE SET count = excluded.count",
  )
    .bind(day, SESSION_CAPS.globalPerDay)
    .run();
}

const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? -1;

afterEach(async () => {
  await env.DB.prepare("DELETE FROM quota_counter WHERE scope = 'session_new'").run();
});

describe('session degrade bounds (review L1, L6)', () => {
  test('L1: over the global cap the per-IP cap still bounds degrade calls (429, no write)', async () => {
    const h = makeMem();
    await fillGlobal(h.clock.now);
    const ip = '192.0.2.77';
    for (let i = 0; i < SESSION_CAPS.perIpPerDay; i++) {
      const r = await post(h, { ip });
      expect(r.status).toBe(200);
      expect(r.body.read_only).toBe(true);
    }
    const rowsBefore = await count('SELECT SUM(count) AS n FROM quota_counter');
    h.resetStats();
    const over = await post(h, { ip });
    expect(over.status).toBe(429);
    expect(over.body.error).toMatchObject({ code: 'rate_limited', reason: 'session_limit' });
    expect(h.stats.rowsWritten).toBe(0);
    expect(await count('SELECT SUM(count) AS n FROM quota_counter')).toBe(rowsBefore);
  });

  test('L6: a live sandbox cookie is kept (not replaced by the ro cookie) at the global cap', async () => {
    const h = makeMem();
    const first = await post(h, { ip: '192.0.2.78' });
    expect(first.status).toBe(200);
    const cookie = cookieOf(first.res)!;
    await fillGlobal(h.clock.now);
    const wsBefore = await count('SELECT COUNT(*) AS n FROM workspace');
    const again = await post(h, { ip: '192.0.2.78', cookie });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({
      workspace_id: first.body.workspace_id,
      analyst_id: first.body.analyst_id,
      kind: 'sandbox',
      read_only: false,
    });
    expect(await count('SELECT COUNT(*) AS n FROM workspace')).toBe(wsBefore);
    const set = cookieOf(again.res);
    if (set) {
      const v = await verifyCookie(cookieValue(set), KEYS, Math.floor(h.clock.now / 1000));
      expect(v.ok && v.claims.w).toBe(first.body.workspace_id);
    }
    // the sandbox is still writable with the original cookie
    const run = await call(
      h,
      'POST',
      '/api/runs',
      {
        client_op_id: 'op-l6-keep-1',
        doc_name: 'd',
        doc_hash: 'a'.repeat(64),
        law_firm_id: null,
        settings_hash: 'b'.repeat(64),
      },
      { cookie },
    );
    expect(run.status).toBe(200);
  });

  test('L6: an expired/unknown sandbox cookie still degrades to the read-only demo', async () => {
    const h = makeMem();
    const first = await post(h, { ip: '192.0.2.79' });
    const cookie = cookieOf(first.res)!;
    await env.DB.prepare('UPDATE workspace SET expires_at = 1 WHERE id = ?1')
      .bind(first.body.workspace_id)
      .run();
    await fillGlobal(h.clock.now);
    const r = await post(h, { ip: '192.0.2.79', cookie });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ read_only: true, workspace_id: 'ws_demo' });
  });
});

describe('session reuse before the per-IP claim (fix cycle 2, N6)', () => {
  const ipCount = async (ip: string) =>
    count(
      `SELECT COALESCE(SUM(count), 0) AS n FROM quota_counter WHERE scope = 'session_new' AND key LIKE 'snew|ip|%'`,
    ).then((n) => ({ ip, n }));

  test('reloads with a live sandbox cookie never mint and never burn an IP claim', async () => {
    const h = makeMem();
    const ip = '192.0.2.90';
    const first = await post(h, { ip });
    expect(first.status).toBe(200);
    const cookie = cookieOf(first.res)!;
    const ipBefore = (await ipCount(ip)).n;
    const wsBefore = await count('SELECT COUNT(*) AS n FROM workspace');
    // more reloads than the per-IP cap: all keep the same sandbox, no claim is taken
    for (let i = 0; i < SESSION_CAPS.perIpPerDay + 2; i++) {
      h.resetStats();
      const r = await post(h, { ip, cookie });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ workspace_id: first.body.workspace_id, read_only: false });
      expect(h.stats.rowsWritten).toBe(0);
    }
    expect((await ipCount(ip)).n).toBe(ipBefore);
    expect(await count('SELECT COUNT(*) AS n FROM workspace')).toBe(wsBefore);
  });

  test('a read-only demo cookie is never reused as a sandbox (isolation)', async () => {
    const h = makeMem();
    await fillGlobal(h.clock.now);
    const ro = await post(h, { ip: '192.0.2.91' });
    expect(ro.body.read_only).toBe(true);
    await env.DB.prepare("DELETE FROM quota_counter WHERE scope = 'session_new'").run();
    const again = await post(h, { ip: '192.0.2.91', cookie: cookieOf(ro.res)! });
    expect(again.status).toBe(200);
    expect(again.body.kind).toBe('sandbox');
    expect(again.body.workspace_id).not.toBe('ws_demo');
    const v = await verifyCookie(
      cookieValue(cookieOf(again.res)!),
      KEYS,
      Math.floor(h.clock.now / 1000),
    );
    expect(v.ok && v.claims.w).toBe(again.body.workspace_id);
  });
});
