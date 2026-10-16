// AC57: a new sandbox is a copy of the demo seed: prior decisions show up in lookup, rules and the
// rules_hash equal the demo's, seed_of is set, rule evidence maps to the copied decisions.
import { env } from 'cloudflare:test';
import { fingerprint, mask, quoteHash, resolveLabel } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { createRulesPort } from '../../src/platform/rules';
import { call, lookup, makeMem, session } from './memory-harness';

describe('demo-seed-copy-effects (AC57)', () => {
  test('seed decisions are visible through lookup in a fresh sandbox', async () => {
    const h = makeMem();
    const s = await session(h);
    const quote = 'The Investor shall subscribe for Units in the Fund as set out in Part B.';
    const fp = fingerprint('firm-x', 'defined_term_issue', quoteHash(quote));
    const r = await lookup(h, s, 'firm-x', [fp]);
    expect(r.body.decisions).toHaveLength(1);
    const d = r.body.decisions[0];
    expect(d).toMatchObject({
      id: `${s.workspaceId}:sd01`,
      decision: 'dismissed',
      reason_code: 'firm_standard_wording',
      fund_name: 'Demo Fund I',
    });
    expect(
      resolveLabel({ severity: 'medium', issue_class: 'defined_term_issue', fingerprint: fp }, d),
    ).toBe('previously_dismissed');
    expect(
      resolveLabel({ severity: 'high', issue_class: 'defined_term_issue', fingerprint: fp }, d),
    ).toBe('dismissed_reconfirm');
    // the masked sensitive seed matches by its masked fingerprint
    const sens = 'Wire subscription monies to account number 001234567 at the Bank.';
    const fpSens = fingerprint(
      'firm-x',
      'sensitive_data',
      quoteHash(mask(sens, [{ start: 43, end: 52 }])),
    );
    expect((await lookup(h, s, 'firm-x', [fpSens])).body.decisions).toHaveLength(1);
  });

  test('rules, seed_of, evidence and rules_hash equal the demo', async () => {
    const h = makeMem();
    const s = await session(h);
    for (const firm of ['firm-x', 'partners-group', 'firm-y']) {
      const demo = await createRulesPort(env.DB, 'ws_demo').activeRules(firm);
      const mine = await createRulesPort(env.DB, s.workspaceId).activeRules(firm);
      expect(mine).toEqual(demo);
    }
    const rules = await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, {
      cookie: s.cookie,
    });
    const sr01 = rules.body.rules.find((r: { id: string }) => r.id === `${s.workspaceId}:sr01`);
    expect(sr01).toMatchObject({ origin: 'seed', status: 'active', evidence_count: 3 });
    const seedOf = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1 AND seed_of IS NOT NULL',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    const demoN = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM decision WHERE workspace_id = 'ws_demo'",
    ).first<{ n: number }>();
    expect(seedOf?.n).toBe(demoN?.n);
    const audit = await call(h, 'GET', '/api/audit?limit=100', undefined, { cookie: s.cookie });
    expect(
      audit.body.events.filter((e: { action: string }) => e.action === 'session_created'),
    ).toHaveLength(1);
    expect(
      audit.body.events.some(
        (e: { entity_id?: string }) => e.entity_id === `${s.workspaceId}:sd01`,
      ),
    ).toBe(true);
  });
});
