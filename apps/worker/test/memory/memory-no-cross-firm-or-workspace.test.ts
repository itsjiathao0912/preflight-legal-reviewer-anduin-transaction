// AC47: memory never crosses firms or workspaces (API level, composite FK, statement lint).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { QUOTA_SQL } from '../../src/platform/quota';
import { CACHE_SQL } from '../../src/platform/cache';
import { LEDGER_SQL } from '../../src/platform/ledger';
import { BREAKER_SQL } from '../../src/platform/breaker';
import { RULES_PORT_SQL } from '../../src/platform/rules';
import { AUDIT_SQL } from '../../src/memory/repo/audit';
import { COMMENT_SQL } from '../../src/memory/repo/comment';
import { COUNSEL_SQL } from '../../src/memory/repo/counsel';
import { DECISION_SQL } from '../../src/memory/repo/decision';
import { DOCUMENT_SQL } from '../../src/memory/repo/document';
import { FINDING_SQL } from '../../src/memory/repo/finding';
import { FUND_SQL } from '../../src/memory/repo/fund';
import { LOOKUP_SQL } from '../../src/memory/repo/lookup';
import { PURGE_GLOBAL_SQL, PURGE_SQL } from '../../src/memory/repo/purge';
import { RULES_SQL } from '../../src/memory/repo/rules';
import { RUN_SQL } from '../../src/memory/repo/run';
import { WORKSPACE_ID_SCOPED, WORKSPACE_SQL } from '../../src/memory/repo/workspace';
import { PROPOSAL_SQL } from '../../src/memory/proposal';
import { SEED_COPY_SQL } from '../../src/memory/seed-copy';
import { HEALTH_SQL } from '../../src/memory/health';
import { FIRM_SQL } from '../../src/routes/memory/firm';
import { EXPORT_SQL } from '../../src/routes/memory/export';
import { decisionRow, errorOf, insertDecision, mkWorkspace } from './db-fixtures';
import { call, decide, fpOf, lookup, makeMem, newRun, op, session } from './memory-harness';

/** Statements that are global by design: app_meta, ai_cache, quota_counter, spend_ledger. */
const GLOBAL: Record<string, Record<string, string>> = {
  QUOTA_SQL,
  CACHE_SQL,
  LEDGER_SQL,
  BREAKER_SQL,
  HEALTH_SQL,
};
const SCOPED: Record<string, Record<string, string>> = {
  RULES_PORT_SQL,
  AUDIT_SQL,
  COUNSEL_SQL,
  COMMENT_SQL,
  DECISION_SQL,
  DOCUMENT_SQL,
  FINDING_SQL,
  FUND_SQL,
  LOOKUP_SQL,
  RULES_SQL,
  RUN_SQL,
  WORKSPACE_SQL,
  PROPOSAL_SQL,
  SEED_COPY_SQL,
  FIRM_SQL,
  EXPORT_SQL,
  PURGE_SQL,
};
const ALLOWED_UNSCOPED = new Set<string>([
  ...PURGE_GLOBAL_SQL.map((k) => `PURGE_SQL.${k}`),
  ...WORKSPACE_ID_SCOPED.map((k) => `WORKSPACE_SQL.${k}`),
]);

const sources = import.meta.glob(
  ['../../src/memory/**/*.ts', '../../src/platform/**/*.ts', '../../src/routes/memory/**/*.ts'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

describe('memory-no-cross-firm-or-workspace (AC47)', () => {
  test('should not let workspace A read workspace B decisions', async () => {
    const h = makeMem();
    const a = await session(h, 'Ann (simulated analyst)');
    const b = await session(h, 'Ben (simulated analyst)');
    const run = await newRun(h, a);
    const quote = 'Workspace A private dismissal quote.';
    const d = await decide(h, a, { runId: run, quote });
    expect(d.status).toBe(200);
    const fp = fpOf('firm-x', 'defined_term_issue', quote);
    expect((await lookup(h, a, 'firm-x', [fp])).body.decisions).toHaveLength(1);
    expect((await lookup(h, b, 'firm-x', [fp])).body.decisions).toEqual([]);
    // B cannot revoke, list or audit A's memory
    const rv = await call(
      h,
      'POST',
      `/api/decisions/${d.body.decision.id}/revoke`,
      { client_op_id: op(), reason: 'x' },
      { cookie: b.cookie },
    );
    expect(rv.status).toBe(400);
    const firmB = await call(h, 'GET', '/api/memory/firm?law_firm_id=firm-x', undefined, {
      cookie: b.cookie,
    });
    expect(JSON.stringify(firmB.body)).not.toContain(d.body.decision.id);
    const auditB = await call(h, 'GET', '/api/audit?limit=100', undefined, { cookie: b.cookie });
    expect(JSON.stringify(auditB.body)).not.toContain(d.body.decision.id);
    // B cannot attach a decision to A's run
    const cross = await decide(h, b, { runId: run, quote: 'B tries A run.' });
    expect(cross.status).toBe(400);
    expect(cross.body.error.reason).toBe('run_not_found');
  });

  test('memory never crosses firms', async () => {
    const h = makeMem();
    const a = await session(h);
    const runX = await newRun(h, a, 'firm-x');
    const quote = 'Same sentence under two firms.';
    await decide(h, a, { runId: runX, quote });
    // the firm-x fingerprint never matches under firm-y, and the firm-y fingerprint differs
    expect(
      (await lookup(h, a, 'firm-y', [fpOf('firm-x', 'defined_term_issue', quote)])).body.decisions,
    ).toEqual([]);
    expect(
      (await lookup(h, a, 'firm-y', [fpOf('firm-y', 'defined_term_issue', quote)])).body.decisions,
    ).toEqual([]);
    const rulesY = await call(h, 'GET', '/api/rules?law_firm_id=firm-y', undefined, {
      cookie: a.cookie,
    });
    expect(rulesY.body.rules).toEqual([]);
  });

  test('a composite FK makes a cross-workspace child row impossible', async () => {
    const a = await mkWorkspace(env.DB);
    const b = await mkWorkspace(env.DB);
    const d = decisionRow(a);
    await insertDecision(env.DB, d);
    const err = await errorOf(
      env.DB.prepare(
        "INSERT INTO finding_state (workspace_id, review_run_id, finding_key, status, current_decision_id, updated_by_name, updated_at) VALUES (?1, 'r', 'k', 'open', ?2, 'T', 0)",
      )
        .bind(b, d.id)
        .run(),
    );
    expect(err).toContain('FOREIGN KEY constraint failed');
    const sup = await errorOf(
      env.DB.prepare(
        "UPDATE decision SET status = 'superseded', superseded_by_id = 'x' WHERE workspace_id = ?1 AND id = ?2",
      )
        .bind(b, d.id)
        .run(),
    );
    expect(sup).toBe(''); // a workspace-B statement matches zero rows of workspace A
    const still = await env.DB.prepare(
      'SELECT status FROM decision WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(a, d.id)
      .first<{ status: string }>();
    expect(still?.status).toBe('active');
  });

  test('statement lint: every repo/platform SQL binds workspace_id or is declared global', () => {
    for (const [mod, sqls] of Object.entries(SCOPED))
      for (const [k, sql] of Object.entries(sqls))
        if (!ALLOWED_UNSCOPED.has(`${mod}.${k}`))
          expect(sql, `${mod}.${k}`).toMatch(/workspace_id/);
    for (const [mod, sqls] of Object.entries(GLOBAL))
      for (const [k, sql] of Object.entries(sqls))
        expect(sql, `${mod}.${k}`).toMatch(/\b(app_meta|ai_cache|quota_counter|spend_ledger)\b/);
  });

  test('statement lint: no inline SQL string is prepared outside the declared statement maps', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    for (const [file, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/\.prepare\(\s*([^)\n]*)/g)) {
        const arg = (m[1] ?? '').trim();
        const ok =
          /^[A-Z_]+_SQL[.[]/.test(arg) || (file.endsWith('repo/audit.ts') && arg === 'sql');
        expect(ok, `${file}: prepare(${arg})`).toBe(true);
      }
    }
  });
});
