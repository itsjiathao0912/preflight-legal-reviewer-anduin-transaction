// Phase 05 review M3: the active firm-rules read is bounded (LIMIT 101) and create/approve refuse
// the 101st active rule per firm per workspace (frozen `quota_exhausted`, reason `active_rule_cap`).
import { env } from 'cloudflare:test';
import { selectInjectedRules } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { meteredDb } from '../../src/db/meta';
import { ACTIVE_RULES_CAP, createRulesPort } from '../../src/platform/rules';
import { uid } from './db-fixtures';
import { call, makeMem, op, session } from './memory-harness';

async function activeNow(ws: string, firm: string): Promise<number> {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM firm_rule WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active'",
  )
    .bind(ws, firm)
    .first<{ n: number }>();
  return Number(r?.n ?? 0);
}

async function seedRules(ws: string, firm: string, n: number, status = 'active') {
  const stmts = Array.from({ length: n }, (_, i) =>
    env.DB.prepare(
      'INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)',
    ).bind(
      ws,
      uid('fr_'),
      firm,
      status === 'active' ? 'manual' : 'proposed',
      status,
      `Cap rule ${i}.`,
      'T',
    ),
  );
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

describe('active-rule-cap (review M3)', () => {
  test('rules read returns at most 101 rows; rows_read stays bounded; total shows as 100+', async () => {
    const h = makeMem();
    const s = await session(h);
    await seedRules(s.workspaceId, 'firm-x', 150); // only reachable through a write race
    const m = meteredDb(env.DB);
    const got = await createRulesPort(m.db, s.workspaceId).activeRules('firm-x');
    expect(got.texts).toHaveLength(ACTIVE_RULES_CAP + 1);
    expect(m.stats.queries).toBe(1);
    // measured 101 on local D1 with 150+ active rows: the LIMIT bounds rows_read, not the table
    expect(m.stats.rowsRead).toBeLessThanOrEqual(ACTIVE_RULES_CAP + 2);
    const sel = selectInjectedRules(got.texts);
    expect(sel.applied).toBe(20);
    expect(sel.total).toBe(101);
  });

  test('create refuses the 101st active rule with quota_exhausted / active_rule_cap (429)', async () => {
    const h = makeMem();
    const s = await session(h);
    await seedRules(
      s.workspaceId,
      'firm-x',
      ACTIVE_RULES_CAP - (await activeNow(s.workspaceId, 'firm-x')),
    );
    const r = await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-x',
      { client_op_id: op(), text: 'One rule too many.' },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(429);
    expect(r.body.error).toMatchObject({ code: 'quota_exhausted', reason: 'active_rule_cap' });
    // another firm is unaffected
    const other = await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-y',
      { client_op_id: op(), text: 'Other firm rule.' },
      { cookie: s.cookie },
    );
    expect(other.status).toBe(200);
  });

  test('approve refuses when the firm already has 100 active rules', async () => {
    const h = makeMem();
    const s = await session(h);
    await seedRules(
      s.workspaceId,
      'firm-x',
      ACTIVE_RULES_CAP - 1 - (await activeNow(s.workspaceId, 'firm-x')),
    );
    await seedRules(s.workspaceId, 'firm-x', 2, 'proposed');
    const list = await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, {
      cookie: s.cookie,
    });
    const proposed = list.body.rules.filter((x: { status: string }) => x.status === 'proposed');
    expect(proposed.length).toBeGreaterThanOrEqual(2);
    const first = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(proposed[0].id)}/approve`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(first.status).toBe(200); // the 100th active rule
    const second = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(proposed[1].id)}/approve`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(second.status).toBe(429);
    expect(second.body.error).toMatchObject({ code: 'quota_exhausted', reason: 'active_rule_cap' });
  });
});
