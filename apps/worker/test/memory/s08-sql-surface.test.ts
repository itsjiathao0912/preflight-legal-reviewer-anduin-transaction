// Spike S8 (local): the D1 SQL surface the design relies on, against the real migrations.
// Remote-only facts (shared 50-query budget, cron on Free) are recorded in the SPIKE-RESULTS REF.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { ACTIVE_CONFLICT_TEXT, OP_REPLAY_TEXT } from '../../src/db/tx';
import { LOOKUP_SQL } from '../../src/memory/repo/lookup';
import {
  decisionRow,
  errorOf,
  hex64,
  insertDecision,
  insertDecisionStmt,
  mkWorkspace,
  uid,
} from './db-fixtures';

const db = env.DB;

describe('s08-sql-surface (S8, local D1)', () => {
  test('foreign keys are enforced', async () => {
    const r = await db.prepare('PRAGMA foreign_keys').first<{ foreign_keys: number }>();
    expect(r?.foreign_keys).toBe(1);
  });

  test('json_each with ONE bound parameter carries 200 fingerprints', async () => {
    const ws = await mkWorkspace(db);
    const rows = Array.from({ length: 5 }, () => decisionRow(ws));
    await db.batch(rows.map((r) => insertDecisionStmt(db, r)));
    const fps = [
      ...rows.map((r) => r.fingerprint),
      ...Array.from({ length: 195 }, (_, i) => hex64(`x${i}`)),
    ];
    const r = await db.prepare(LOOKUP_SQL.lookup).bind(ws, 'firm-x', JSON.stringify(fps)).all();
    expect(r.results).toHaveLength(5);
  });

  test('100 bound parameters work in one statement (D1 cap; the app never binds more than 25)', async () => {
    const cols = Array.from({ length: 100 }, (_, i) => `?${i + 1} AS c${i}`).join(', ');
    const ok = await db
      .prepare(`SELECT ${cols}`)
      .bind(...Array.from({ length: 100 }, (_, i) => i))
      .first<Record<string, number>>();
    expect(ok?.['c99']).toBe(99);
  });

  test('lookup plan uses the partial unique index uq_decision_active', async () => {
    const plan = await db
      .prepare(`EXPLAIN QUERY PLAN ${LOOKUP_SQL.lookup}`)
      .bind('w', 'firm-x', '[]')
      .all<{ detail: string }>();
    const details = plan.results.map((r) => r.detail).join('\n');
    expect(details).toMatch(/SEARCH d USING (COVERING )?INDEX uq_decision_active/);
  });

  test('triggers RAISE with the recorded message text', async () => {
    const ws = await mkWorkspace(db);
    const row = decisionRow(ws);
    await insertDecision(db, row);
    const del = await errorOf(
      db.prepare('DELETE FROM decision WHERE workspace_id = ?1 AND id = ?2').bind(ws, row.id).run(),
    );
    expect(del).toContain('decision_append_only');
  });

  test('WITHOUT ROWID + composite FK: a child row cannot point into another workspace', async () => {
    const a = await mkWorkspace(db);
    const b = await mkWorkspace(db);
    const parent = decisionRow(a);
    await insertDecision(db, parent);
    const err = await errorOf(
      db
        .prepare(
          'INSERT INTO rule_evidence (workspace_id, rule_id, decision_id, added_at) VALUES (?1, ?2, ?3, 0)',
        )
        .bind(b, 'r-none', parent.id)
        .run(),
    );
    expect(err).toContain('FOREIGN KEY constraint failed');
    const without = await db
      .prepare("SELECT sql FROM sqlite_master WHERE name = 'decision'")
      .first<{ sql: string }>();
    expect(without?.sql).toMatch(/WITHOUT ROWID/);
  });

  test('PRAGMA defer_foreign_keys inside db.batch allows child-before-parent', async () => {
    const ws = await mkWorkspace(db);
    const ruleId = uid('fr_');
    const d = decisionRow(ws);
    await db.batch([
      db.prepare('PRAGMA defer_foreign_keys = ON'),
      db
        .prepare(
          'INSERT INTO rule_evidence (workspace_id, rule_id, decision_id, added_at) VALUES (?1, ?2, ?3, 0)',
        )
        .bind(ws, ruleId, d.id),
      insertDecisionStmt(db, d),
      db
        .prepare(
          "INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at) VALUES (?1, ?2, 'firm-x', 'manual', 'active', 'x', 'T', 0)",
        )
        .bind(ws, ruleId),
    ]);
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM rule_evidence WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  test('purge DELETE passes the append-only trigger only while the workspace is purging', async () => {
    const ws = await mkWorkspace(db);
    await insertDecision(db, decisionRow(ws));
    expect(
      await errorOf(db.prepare('DELETE FROM decision WHERE workspace_id = ?1').bind(ws).run()),
    ).toContain('decision_append_only');
    await db.prepare("UPDATE workspace SET status = 'purging' WHERE id = ?1").bind(ws).run();
    await db.prepare('DELETE FROM decision WHERE workspace_id = ?1').bind(ws).run();
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test('constraint texts tell an op replay from an active-decision conflict', async () => {
    const ws = await mkWorkspace(db);
    const audit = (op: string) =>
      db
        .prepare(
          "INSERT INTO audit_event (workspace_id, id, client_op_id, at, actor_name, action) VALUES (?1, ?2, ?3, 0, 'T', 'decision_recorded')",
        )
        .bind(ws, uid('ae_'), op);
    await audit('op-12345678').run();
    const replay = await errorOf(audit('op-12345678').run());
    expect(replay).toContain(OP_REPLAY_TEXT);
    const first = decisionRow(ws);
    await insertDecision(db, first);
    const conflict = await errorOf(
      insertDecision(db, decisionRow(ws, { fingerprint: first.fingerprint })),
    );
    expect(conflict).toContain(ACTIVE_CONFLICT_TEXT);
    expect(conflict).not.toContain(OP_REPLAY_TEXT);
  });

  test('a failed statement aborts the whole db.batch (atomic)', async () => {
    const ws = await mkWorkspace(db);
    const first = decisionRow(ws);
    const err = await errorOf(
      db.batch([
        insertDecisionStmt(db, first),
        insertDecisionStmt(db, decisionRow(ws, { fingerprint: first.fingerprint })),
      ]),
    );
    expect(err).toContain(ACTIVE_CONFLICT_TEXT);
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test('RETURNING works on INSERT ... ON CONFLICT DO UPDATE', async () => {
    const r = await db
      .prepare(
        "INSERT INTO app_meta (key, value, updated_at) VALUES ('s08-ret', '1', 0) ON CONFLICT(key) DO UPDATE SET value = value || '1' RETURNING value",
      )
      .first<{ value: string }>();
    expect(r?.value).toBe('1');
  });

  test('meta.rows_written is reported for writes through the binding', async () => {
    const ws = await mkWorkspace(db);
    const r = await insertDecisionStmt(db, decisionRow(ws)).run();
    expect(r.meta.rows_written).toBeGreaterThan(0);
  });
});
