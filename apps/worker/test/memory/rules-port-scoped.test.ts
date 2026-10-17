// AC47 / AC51 hand-off: RulesPort is workspace-bound; only active rules; rules_hash = core rulesHash.
import { env } from 'cloudflare:test';
import { rulesHash } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import * as rulesModule from '../../src/platform/rules';
import { mkWorkspace, uid } from './db-fixtures';

async function rule(ws: string, firm: string, status: string, text: string) {
  await env.DB.prepare(
    "INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at, revoked_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'T', 1, ?7)",
  )
    .bind(
      ws,
      uid('fr_'),
      firm,
      status === 'active' || status === 'revoked' ? 'manual' : 'proposed',
      status,
      text,
      status === 'revoked' ? 2 : null,
    )
    .run();
}

describe('rules-port-scoped (AC47, AC51)', () => {
  test('only active rules of the bound workspace and firm; rules_hash from core', async () => {
    const a = await mkWorkspace(env.DB);
    const b = await mkWorkspace(env.DB);
    await rule(a, 'firm-x', 'active', 'Rule two.');
    await rule(a, 'firm-x', 'active', 'Rule one.');
    await rule(a, 'firm-x', 'proposed', 'Proposed never reaches AI.');
    await rule(a, 'firm-x', 'rejected', 'Rejected.');
    await rule(a, 'firm-x', 'revoked', 'Revoked.');
    await rule(a, 'firm-y', 'active', 'Other firm.');
    await rule(b, 'firm-x', 'active', 'Other workspace.');
    const got = await rulesModule.createRulesPort(env.DB, a).activeRules('firm-x');
    expect([...got.texts].sort()).toEqual(['Rule one.', 'Rule two.']);
    expect(got.rules_hash).toBe(rulesHash(got.texts));
    expect(await rulesModule.createRulesPort(env.DB, b).activeRules('firm-y')).toEqual({
      texts: [],
      rules_hash: 'none',
    });
  });

  test('the module exports only the workspace-bound factory (no unscoped read)', () => {
    expect(Object.keys(rulesModule).sort()).toEqual([
      'ACTIVE_RULES_CAP',
      'RULES_PORT_SQL',
      'createRulesPort',
    ]);
    expect(rulesModule.RULES_PORT_SQL.active).toMatch(
      /workspace_id = \?1 AND law_firm_id = \?2 AND status = 'active'/,
    );
    expect(rulesModule.RULES_PORT_SQL.active).toMatch(/LIMIT 101$/); // review M3 read bound
    expect(() => rulesModule.createRulesPort(env.DB, '')).toThrow();
  });
});
