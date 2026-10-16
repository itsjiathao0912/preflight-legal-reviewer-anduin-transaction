// AC57: the demo workspace is seeded, protected and never bound to a cookie; seed_mode fail-safe.
import { env } from 'cloudflare:test';
import { signCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { decisionRow, errorOf, insertDecision } from './db-fixtures';
import { call, COOKIE_KEY, decide, makeMem, newRun, session } from './memory-harness';

async function demoCounts(): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const t of ['analyst', 'decision', 'firm_rule', 'rule_evidence', 'audit_event'])
    out[t] = (
      await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE workspace_id = 'ws_demo'`).first<{
        n: number;
      }>()
    )?.n;
  return JSON.stringify(out);
}

describe('demo-workspace-not-polluted (AC57)', () => {
  test('should not write to the demo workspace outside seed mode', async () => {
    expect(await errorOf(insertDecision(env.DB, decisionRow('ws_demo')))).toContain(
      'demo_read_only',
    );
    expect(
      await errorOf(
        env.DB.prepare(
          "UPDATE decision SET status = 'revoked', revoked_at = 1, revoke_reason = 'x' WHERE workspace_id = 'ws_demo'",
        ).run(),
      ),
    ).toContain('demo_read_only');
    expect(
      await errorOf(
        env.DB.prepare(
          "INSERT INTO audit_event (workspace_id, id, client_op_id, at, actor_name, action) VALUES ('ws_demo', 'x', 'op-xxxxxxxx', 1, 'T', 'rule_added')",
        ).run(),
      ),
    ).toContain('demo_read_only');
    expect(
      await errorOf(
        env.DB.prepare("UPDATE workspace SET last_active_at = 5 WHERE id = 'ws_demo'").run(),
      ),
    ).toContain('demo_read_only');
    expect(
      await errorOf(env.DB.prepare("DELETE FROM workspace WHERE id = 'ws_demo'").run()),
    ).toContain('demo_read_only');
  });

  test('normal API use never changes the demo rows', async () => {
    const before = await demoCounts();
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await decide(h, s, { runId: run, quote: 'Demo stays clean.' });
    const seedCopy = await env.DB.prepare(
      "SELECT id FROM decision WHERE workspace_id = ?1 AND seed_of = 'sd01'",
    )
      .bind(s.workspaceId)
      .first<{ id: string }>();
    await call(
      h,
      'POST',
      `/api/decisions/${seedCopy!.id}/revoke`,
      { client_op_id: 'op-demo-rv1', reason: 'reopen' },
      { cookie: s.cookie },
    );
    expect(await demoCounts()).toBe(before);
    const demo = await env.DB.prepare(
      "SELECT status FROM decision WHERE workspace_id = 'ws_demo' AND id = 'sd01'",
    ).first<{ status: string }>();
    expect(demo?.status).toBe('active');
  });

  test('a cookie bound to ws_demo (even correctly signed) is never accepted', async () => {
    const h = makeMem();
    const nowS = Math.floor(h.clock.now / 1000);
    const c = await signCookie(
      { v: 'v1', w: 'ws_demo', a: 'an_seed1', iat: nowS, exp: nowS + 3600, kid: 'k1' },
      COOKIE_KEY,
    );
    const r = await call(h, 'GET', '/api/audit?limit=1', undefined, {
      cookie: `${VISITOR_COOKIE}=${c}`,
    });
    expect(r.status).toBe(401);
  });

  test("seed_mode != '0' makes writes 503 memory_unavailable (reads still work)", async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await env.DB.prepare("UPDATE app_meta SET value = '1' WHERE key = 'seed_mode'").run();
    try {
      const w = await decide(h, s, { runId: run, quote: 'Blocked while seeding.' });
      expect(w.status).toBe(503);
      expect(w.body.error.code).toBe('memory_unavailable');
      expect((await call(h, 'POST', '/api/session', { analyst_name: 'X' })).status).toBe(503);
      expect(
        (await call(h, 'GET', '/api/audit?limit=1', undefined, { cookie: s.cookie })).status,
      ).toBe(200);
      expect((await call(h, 'GET', '/api/memory/health')).status).toBe(503);
    } finally {
      await env.DB.prepare("UPDATE app_meta SET value = '0' WHERE key = 'seed_mode'").run();
    }
    expect((await decide(h, s, { runId: run, quote: 'Allowed again.' })).status).toBe(200);
  });
});
