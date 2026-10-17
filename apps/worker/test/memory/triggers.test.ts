// Database-level enforcement: CHECKs, partial unique index, append-only and transition triggers.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { decisionRow, errorOf, insertDecision, mkWorkspace, uid } from './db-fixtures';
import { makeMem, session } from './memory-harness';
import { answer, askQuestion, withAssertion } from './variance-harness';

const db = env.DB;
const upd = (ws: string, id: string, set: string) =>
  errorOf(
    db.prepare(`UPDATE decision SET ${set} WHERE workspace_id = ?1 AND id = ?2`).bind(ws, id).run(),
  );

describe('triggers (AC42, AC6, AC55)', () => {
  test('should allow at most one active decision per workspace firm and fingerprint', async () => {
    const ws = await mkWorkspace(db);
    const a = decisionRow(ws);
    await insertDecision(db, a);
    expect(
      await errorOf(insertDecision(db, decisionRow(ws, { fingerprint: a.fingerprint }))),
    ).toContain('UNIQUE constraint failed');
    // another firm or a non-active row with the same fingerprint is fine
    await insertDecision(
      db,
      decisionRow(ws, { fingerprint: a.fingerprint, law_firm_id: 'firm-y' }),
    );
    await insertDecision(db, decisionRow(ws, { fingerprint: a.fingerprint, status: 'superseded' }));
    const other = await mkWorkspace(db);
    await insertDecision(db, decisionRow(other, { fingerprint: a.fingerprint }));
  });

  test('should refuse dismiss without reason_code at the database level', async () => {
    const ws = await mkWorkspace(db);
    expect(
      await errorOf(
        insertDecision(db, decisionRow(ws, { decision: 'dismissed', reason_code: null })),
      ),
    ).toContain('CHECK constraint failed');
    expect(
      await errorOf(
        insertDecision(db, decisionRow(ws, { decision: 'answered', counsel_option: null })),
      ),
    ).toContain('CHECK constraint failed');
    expect(
      await errorOf(
        insertDecision(db, decisionRow(ws, { reason_code: 'nonsense', decision: 'dismissed' })),
      ),
    ).toContain('CHECK constraint failed');
  });

  test('transitions are only active -> superseded | revoked; terminal rows never change', async () => {
    const ws = await mkWorkspace(db);
    const a = decisionRow(ws);
    await insertDecision(db, a);
    expect(await upd(ws, a.id, "status = 'revoked'")).toContain('CHECK constraint failed'); // revoked needs revoked_at + reason
    expect(
      await upd(
        ws,
        a.id,
        "status = 'revoked', revoked_at = 5, revoke_reason = 'r', revoked_by_name = 'T'",
      ),
    ).toBe('');
    expect(await upd(ws, a.id, "status = 'active'")).toContain('decision_immutable');
    expect(await upd(ws, a.id, "status = 'superseded'")).toContain('decision_immutable');
    const b = decisionRow(ws);
    await insertDecision(db, b);
    expect(await upd(ws, b.id, "status = 'superseded', superseded_by_id = 'x'")).toBe('');
    expect(
      await upd(ws, b.id, "status = 'revoked', revoked_at = 5, revoke_reason = 'r'"),
    ).toContain('decision_immutable');
  });

  test('every immutable column is guarded, even on an active row', async () => {
    const ws = await mkWorkspace(db);
    const a = decisionRow(ws);
    await insertDecision(db, a);
    for (const set of [
      "note = 'edited'",
      "reason_code = 'other'",
      'decided_at = 99',
      "decided_by_name = 'X'",
      "fund_name = 'X'",
      "quote_snippet = 'X'",
      "law_firm_id = 'firm-y'",
      "issue_class = 'placeholder'",
      "pattern_key = 'x'",
      "counsel_note = 'x'",
      "origin_review_run_id = 'x'",
      "seed_of = 'x'",
      'fp_version = 2',
    ])
      expect(await upd(ws, a.id, set), set).toContain('decision_immutable');
  });

  test('audit_event and counsel_answer are append-only; rule text is editable only while proposed', async () => {
    const ws = await mkWorkspace(db);
    await db
      .prepare(
        "INSERT INTO audit_event (workspace_id, id, client_op_id, at, actor_name, action) VALUES (?1, 'ae1', 'op-aaaaaaaa', 1, 'T', 'decision_recorded')",
      )
      .bind(ws)
      .run();
    expect(
      await errorOf(
        db.prepare("UPDATE audit_event SET reason = 'x' WHERE workspace_id = ?1").bind(ws).run(),
      ),
    ).toContain('audit_append_only');
    expect(
      await errorOf(db.prepare('DELETE FROM audit_event WHERE workspace_id = ?1').bind(ws).run()),
    ).toContain('audit_append_only');
    const rule = uid('fr_');
    await db
      .prepare(
        "INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, proposal_key, created_by_name, created_at) VALUES (?1, ?2, 'firm-x', 'proposed', 'proposed', 'a', 'k|firm_standard_wording', 'T', 1)",
      )
      .bind(ws, rule)
      .run();
    expect(
      await errorOf(
        db
          .prepare("UPDATE firm_rule SET rule_text = 'b' WHERE workspace_id = ?1 AND id = ?2")
          .bind(ws, rule)
          .run(),
      ),
    ).toBe('');
    expect(
      await errorOf(
        db
          .prepare(
            "UPDATE firm_rule SET status = 'active', decided_at = 2 WHERE workspace_id = ?1 AND id = ?2",
          )
          .bind(ws, rule)
          .run(),
      ),
    ).toBe('');
    expect(
      await errorOf(
        db
          .prepare("UPDATE firm_rule SET rule_text = 'c' WHERE workspace_id = ?1 AND id = ?2")
          .bind(ws, rule)
          .run(),
      ),
    ).toContain('rule_immutable');
    expect(
      await errorOf(
        db
          .prepare("UPDATE firm_rule SET status = 'proposed' WHERE workspace_id = ?1 AND id = ?2")
          .bind(ws, rule)
          .run(),
      ),
    ).toContain('rule_immutable');
  });

  test('variance 0006: regression_check allows only the active -> revoked flip; every column is immutable', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: 'hartwell-crane' });
    expect((await answer(h, s, q, withAssertion())).status).toBe(200);
    const ws = s.workspaceId;
    const rc = await db
      .prepare('SELECT id FROM regression_check WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ id: string }>();
    const updRc = (set: string) =>
      errorOf(
        db
          .prepare(`UPDATE regression_check SET ${set} WHERE workspace_id = ?1 AND id = ?2`)
          .bind(ws, rc!.id)
          .run(),
      );
    for (const set of [
      "law_firm_id = 'firm-x'",
      "source_answer_id = 'x'",
      "source_fund_name = 'X'",
      "assertion_key = 'appendix d'",
      "statement_text = 'X'",
      'created_at = 1',
      "status = 'active'",
    ])
      expect(await updRc(set), set).toContain('regression_check_immutable');
    expect(
      await errorOf(
        db.prepare('DELETE FROM regression_check WHERE workspace_id = ?1').bind(ws).run(),
      ),
    ).toContain('regression_check_append_only');
    expect(await updRc("status = 'revoked'")).toBe('');
    expect(await updRc("status = 'active'")).toContain('regression_check_immutable');
    // CHECKs: kind enum, key length 1..80, statement length 1..300
    const ans = await db
      .prepare('SELECT id FROM counsel_answer WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ id: string }>();
    const ins = (kind: string, key: string, stmt: string) =>
      errorOf(
        db
          .prepare(
            "INSERT INTO regression_check (workspace_id, id, law_firm_id, source_answer_id, source_fund_name, assertion_kind, assertion_key, statement_text, created_at) VALUES (?1, ?2, 'hartwell-crane', ?3, 'F', ?4, ?5, ?6, 1)",
          )
          .bind(ws, uid('rc_'), ans!.id, kind, key, stmt)
          .run(),
      );
    expect(await ins('scope_missing', 'appendix c', 'S')).toContain('CHECK constraint failed');
    expect(await ins('scope_exists', '', 'S')).toContain('CHECK constraint failed');
    expect(await ins('scope_exists', 'k'.repeat(81), 'S')).toContain('CHECK constraint failed');
    expect(await ins('scope_exists', 'k', 's'.repeat(301))).toContain('CHECK constraint failed');
  });

  test('variance 0006: regression_check delete is blocked outside purging and allowed while purging', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: 'hartwell-crane' });
    expect((await answer(h, s, q, withAssertion())).status).toBe(200);
    const ws = s.workspaceId;
    const del = () =>
      errorOf(db.prepare('DELETE FROM regression_check WHERE workspace_id = ?1').bind(ws).run());
    expect(await del()).toContain('regression_check_append_only');
    await db.prepare("UPDATE workspace SET status = 'purging' WHERE id = ?1").bind(ws).run();
    expect(await del()).toBe('');
    const n = await db
      .prepare('SELECT COUNT(*) AS n FROM regression_check WHERE workspace_id = ?1')
      .bind(ws)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  test('variance 0006: owner/scope/intent CHECK lists and question_owner_immutable', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { extra: { owner: 'gp' } });
    const ws = s.workspaceId;
    expect(
      await errorOf(
        db
          .prepare(
            "UPDATE counsel_question SET owner = 'counsel' WHERE workspace_id = ?1 AND id = ?2",
          )
          .bind(ws, q.questionId)
          .run(),
      ),
    ).toContain('question_owner_immutable');
    const sql = async (t: string) =>
      (await db
        .prepare('SELECT sql FROM sqlite_master WHERE name = ?1')
        .bind(t)
        .first<{ sql: string }>())!.sql;
    expect(await sql('counsel_question')).toMatch(/owner IN \('counsel','gp','fund_admin'\)/);
    expect(await sql('counsel_question')).toMatch(/owner_source IN \('suggested','override'\)/);
    for (const t of ['counsel_answer', 'decision']) {
      expect(await sql(t), t).toMatch(/scope IN \('fund','firm_template'\)/);
      expect(await sql(t), t).toMatch(/length\(intent\) <= 500/);
    }
  });
});
