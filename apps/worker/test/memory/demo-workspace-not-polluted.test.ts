// AC57: the demo workspace is seeded, protected and never bound to a cookie; seed_mode fail-safe.
import { env } from 'cloudflare:test';
import { signCookie } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { VISITOR_COOKIE } from '../../src/limits/visitor';
import { decisionRow, errorOf, insertDecision } from './db-fixtures';
import {
  call,
  COOKIE_KEY,
  decide,
  fpOf,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
} from './memory-harness';

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

  test('L3 (migration 0005): the demo UPDATE/DELETE triggers exist', async () => {
    const r = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'demo_ro_%'",
    ).all<{ name: string }>();
    const names = new Set(r.results.map((x) => x.name));
    for (const t of ['review_run', 'counsel_answer', 'fund', 'document', 'analyst'])
      expect(names.has(`demo_ro_${t}_update`), t).toBe(true);
    for (const t of DELETE_TABLES) expect(names.has(`demo_ro_${t}_delete`), t).toBe(true);
  });

  test('L3: seeded ws_demo rows cannot be updated or deleted outside seed mode', async () => {
    for (const sql of [
      "UPDATE analyst SET display_name = 'x' WHERE workspace_id = 'ws_demo'",
      "DELETE FROM analyst WHERE workspace_id = 'ws_demo'",
      "DELETE FROM firm_rule WHERE workspace_id = 'ws_demo'",
      "DELETE FROM rule_evidence WHERE workspace_id = 'ws_demo'",
    ])
      expect(await errorOf(env.DB.prepare(sql).run()), sql).toContain('demo_read_only');
  });

  // LAST in this file: converts a sandbox to kind='demo' (it can never be deleted afterwards).
  test('L3: every newly protected table refuses UPDATE/DELETE on a demo-kind workspace', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const f = wireFinding('firm-x', 'Demo trigger finding.');
    expect(
      (
        await call(
          h,
          'POST',
          `/api/runs/${run}/findings`,
          { client_op_id: op(), findings: [f] },
          { cookie: s.cookie },
        )
      ).status,
    ).toBe(200);
    const quote = 'Demo trigger counsel quote.';
    const fp = fpOf('firm-x', 'ambiguity', quote);
    await decide(h, s, {
      runId: run,
      quote,
      decision: 'accepted',
      cls: 'ambiguity',
      findingRef: 'dq',
    });
    const q = await call(
      h,
      'POST',
      '/api/counsel/questions',
      { client_op_id: op(), finding_ref: 'dq', fingerprint: fp, interpretations: ['a', 'b'] },
      { cookie: s.cookie },
    );
    expect(q.status).toBe(200);
    const a = await call(
      h,
      'POST',
      '/api/counsel/answers',
      {
        client_op_id: op(),
        question_id: q.body.question_id,
        option: 'A',
        quote_text: quote,
        fingerprint: fp,
      },
      { cookie: s.cookie },
    );
    expect(a.status).toBe(200);
    const ws = s.workspaceId;
    for (const t of [...DELETE_TABLES, 'counsel_answer']) {
      const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE workspace_id = ?1`)
        .bind(ws)
        .first<{ n: number }>();
      if (t !== 'firm_rule' && t !== 'rule_evidence') expect(n?.n, t).toBeGreaterThan(0);
    }
    await env.DB.prepare("UPDATE workspace SET kind = 'demo', expires_at = NULL WHERE id = ?1")
      .bind(ws)
      .run();
    const updates: [string, string][] = [
      ['review_run', 'engine_version = engine_version'],
      ['counsel_answer', 'answered_at = answered_at'],
      ['fund', 'name = name'],
      ['document', 'display_name = display_name'],
      ['analyst', 'display_name = display_name'],
    ];
    for (const [t, set] of updates)
      expect(
        await errorOf(
          env.DB.prepare(`UPDATE ${t} SET ${set} WHERE workspace_id = ?1`).bind(ws).run(),
        ),
        `update ${t}`,
      ).toContain('demo_read_only');
    for (const t of [
      'finding',
      'finding_state',
      'counsel_question',
      'review_run',
      'document',
      'fund',
      'analyst',
    ])
      expect(
        await errorOf(env.DB.prepare(`DELETE FROM ${t} WHERE workspace_id = ?1`).bind(ws).run()),
        `delete ${t}`,
      ).toContain('demo_read_only');
  });
});

const DELETE_TABLES = [
  'firm_rule',
  'rule_evidence',
  'analyst',
  'fund',
  'document',
  'review_run',
  'finding',
  'finding_state',
  'counsel_question',
];
