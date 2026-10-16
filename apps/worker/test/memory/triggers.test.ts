// Database-level enforcement: CHECKs, partial unique index, append-only and transition triggers.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { decisionRow, errorOf, insertDecision, mkWorkspace, uid } from './db-fixtures';

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
});
