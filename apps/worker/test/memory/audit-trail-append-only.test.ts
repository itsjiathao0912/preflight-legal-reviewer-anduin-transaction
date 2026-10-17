// AC55: append-only audit trail (who, when, why). Every write op produces exactly one audit row
// (inserted first in its batch); UPDATE/DELETE fail; GET /api/audit pages newest first.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { errorOf } from './db-fixtures';
import { call, decide, makeMem, newRun, op, session } from './memory-harness';
import { answer, askQuestion, withAssertion } from './variance-harness';

async function own(ws: string) {
  return (
    await env.DB.prepare(
      "SELECT action, actor_name, reason, at FROM audit_event WHERE workspace_id = ?1 AND client_op_id NOT LIKE 'seed:%' ORDER BY at, id",
    )
      .bind(ws)
      .all<{ action: string; actor_name: string; reason: string | null; at: number }>()
  ).results;
}

describe('audit-trail-append-only (AC55)', () => {
  test('one audit row per write: session, decision, revoke, rule add/approve, answer, export', async () => {
    const h = makeMem();
    const s = await session(h, 'Gil (simulated analyst)');
    const run = await newRun(h, s);
    const d = await decide(h, s, {
      runId: run,
      quote: 'Audit me.',
      decision: 'accepted',
      findingRef: 'fa1',
    });
    await call(
      h,
      'POST',
      `/api/decisions/${d.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'Opened by mistake' },
      { cookie: s.cookie },
    );
    const rule = await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-y',
      { client_op_id: op(), text: 'A rule.' },
      { cookie: s.cookie },
    );
    await call(
      h,
      'POST',
      `/api/rules/${rule.body.rule.id}/revoke`,
      { client_op_id: op(), text: 'not needed' },
      { cookie: s.cookie },
    );
    await call(
      h,
      'POST',
      `/api/runs/${run}/export`,
      { client_op_id: op(), question_count: 0 },
      { cookie: s.cookie },
    );
    const rows = await own(s.workspaceId);
    expect(rows.map((r) => r.action)).toEqual([
      'session_created',
      'decision_recorded',
      'decision_revoked',
      'rule_added',
      'rule_revoked',
      'counsel_sheet_exported',
    ]);
    expect(rows.every((r) => r.actor_name === 'Gil (simulated analyst)')).toBe(true);
    expect(rows.find((r) => r.action === 'decision_revoked')?.reason).toBe('Opened by mistake');
    expect(rows.map((r) => r.at)).toEqual([...rows.map((r) => r.at)].sort((a, b) => a - b));
  });

  test('audit rows cannot be updated or deleted (outside a purge)', async () => {
    const h = makeMem();
    const s = await session(h);
    expect(
      await errorOf(
        env.DB.prepare("UPDATE audit_event SET actor_name = 'X' WHERE workspace_id = ?1")
          .bind(s.workspaceId)
          .run(),
      ),
    ).toContain('audit_append_only');
    expect(
      await errorOf(
        env.DB.prepare('DELETE FROM audit_event WHERE workspace_id = ?1').bind(s.workspaceId).run(),
      ),
    ).toContain('audit_append_only');
  });

  test('GET /api/audit returns who/when/why newest first with keyset paging', async () => {
    const h = makeMem();
    const s = await session(h, 'Hal (simulated analyst)');
    const run = await newRun(h, s);
    const d = await decide(h, s, { runId: run, quote: 'Paging quote.' });
    await call(
      h,
      'POST',
      `/api/decisions/${d.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'why: test' },
      { cookie: s.cookie },
    );
    const first = await call(h, 'GET', '/api/audit?limit=2', undefined, { cookie: s.cookie });
    expect(first.body.events.map((e: { action: string }) => e.action)).toEqual([
      'decision_revoked',
      'decision_recorded',
    ]);
    expect(first.body.events[0]).toMatchObject({
      actor_name: 'Hal (simulated analyst)',
      reason: 'why: test',
      entity_type: 'decision',
      entity_id: d.body.decision.id,
    });
    const all: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await call(
        h,
        'GET',
        `/api/audit?limit=3${cursor ? `&cursor=${cursor}` : ''}`,
        undefined,
        { cookie: s.cookie },
      );
      all.push(...p.body.events.map((e: { id: string }) => e.id));
      cursor = p.body.next_cursor;
    } while (cursor);
    expect(new Set(all).size).toBe(all.length);
    const total = (await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>())!.n;
    expect(all.length).toBe(total);
    expect(
      (await call(h, 'GET', '/api/audit?limit=1&cursor=%%%', undefined, { cookie: s.cookie }))
        .status,
    ).toBe(400);
  });

  test('variance: a created check has its own regression_check_created audit row (ids and enums only)', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: 'hartwell-crane' });
    const r = await answer(h, s, q, withAssertion());
    expect(r.status).toBe(200);
    const page = await call(h, 'GET', '/api/audit?limit=5', undefined, { cookie: s.cookie });
    const ev = page.body.events.find(
      (e: { action: string }) => e.action === 'regression_check_created',
    );
    expect(ev).toMatchObject({
      action: 'regression_check_created',
      law_firm_id: 'hartwell-crane',
      entity_type: 'regression_check',
      detail: { assertion_kind: 'scope_exists', source_answer_id: r.body.answer_id },
    });
    expect(
      await errorOf(
        env.DB.prepare(
          "DELETE FROM audit_event WHERE workspace_id = ?1 AND action = 'regression_check_created'",
        )
          .bind(s.workspaceId)
          .run(),
      ),
    ).toContain('audit_append_only');
  });
});
