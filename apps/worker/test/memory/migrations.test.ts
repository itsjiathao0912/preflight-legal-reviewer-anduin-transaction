// Migrations 0001-0004 apply on local D1: 20 tables, schema_version set LAST by each migration.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { EXPECTED_SCHEMA_VERSION } from '../../src/memory/health';

const TABLES = [
  'ai_cache',
  'analyst',
  'app_meta',
  'audit_event',
  'counsel_answer',
  'counsel_question',
  'decision',
  'document',
  'finding',
  'finding_state',
  'firm_rule',
  'fund',
  'issue_class',
  'law_firm',
  'law_firm_alias',
  'quota_counter',
  'review_run',
  'rule_evidence',
  'spend_ledger',
  'workspace',
];

describe('migrations (AC42, AC43, AC47)', () => {
  test('0001-0004 are applied in order and recorded', async () => {
    const r = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY id').all<{
      name: string;
    }>();
    expect(r.results.map((x) => x.name)).toEqual([
      '0001_reference_and_workspace.sql',
      '0002_memory_core.sql',
      '0003_reference_seed.sql',
      '0004_cache_quota_ledger.sql',
    ]);
  });

  test('exactly the 20 designed tables exist (9 + 8 + 3)', async () => {
    const r = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name",
    ).all<{ name: string }>();
    expect(r.results.map((x) => x.name)).toEqual(TABLES);
  });

  test('workspace-scoped tables are WITHOUT ROWID with a (workspace_id, ...) primary key', async () => {
    for (const t of [
      'analyst',
      'fund',
      'document',
      'review_run',
      'finding',
      'finding_state',
      'decision',
      'counsel_question',
      'counsel_answer',
      'firm_rule',
      'rule_evidence',
      'audit_event',
    ]) {
      const row = await env.DB.prepare('SELECT sql FROM sqlite_master WHERE name = ?1')
        .bind(t)
        .first<{ sql: string }>();
      expect(row?.sql, t).toMatch(/WITHOUT ROWID/);
      expect(row?.sql, t).toMatch(/PRIMARY KEY \(workspace_id, /);
    }
  });

  test('schema_version is the last statement of each migration and the final value is expected', async () => {
    for (const m of env.TEST_MIGRATIONS) {
      const last = m.queries.filter((q) => q.trim().length > 0).at(-1) ?? '';
      expect(last, m.name).toMatch(/'schema_version'/);
    }
    const v = await env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    ).first<{ value: string }>();
    expect(v?.value).toBe(EXPECTED_SCHEMA_VERSION);
    const sm = await env.DB.prepare("SELECT value FROM app_meta WHERE key = 'seed_mode'").first<{
      value: string;
    }>();
    expect(sm?.value).toBe('0');
  });

  test('the partial and secondary indexes exist', async () => {
    const r = await env.DB.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL",
    ).all<{ name: string; sql: string }>();
    const by = Object.fromEntries(r.results.map((x) => [x.name, x.sql]));
    expect(by['uq_decision_active']).toMatch(/WHERE status = 'active'/);
    expect(by['uq_rule_proposal']).toMatch(/status IN \('proposed','active'\)/);
    for (const i of [
      'ix_decision_page',
      'ix_decision_pattern',
      'ix_audit_ws_time',
      'ix_cache_exp',
      'ix_ws_expiry',
    ])
      expect(by[i], i).toBeDefined();
  });
});
