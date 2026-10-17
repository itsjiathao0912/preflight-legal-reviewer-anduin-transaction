// AC-V14 (append-only): the recreated 0006 guards keep every previously guarded column guarded and
// make intent / scope (answer, decision) and owner / owner_source (question) immutable after insert.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { errorOf } from './db-fixtures';
import { call, makeMem, op, session } from './memory-harness';
import { answer, askQuestion } from './variance-harness';

const db = env.DB;
const upd = (table: string, ws: string, id: string, set: string) =>
  errorOf(
    db.prepare(`UPDATE ${table} SET ${set} WHERE workspace_id = ?1 AND id = ?2`).bind(ws, id).run(),
  );

async function answered() {
  const h = makeMem();
  const s = await session(h);
  const q = await askQuestion(h, s, { extra: { owner: 'counsel', owner_source: 'suggested' } });
  const r = await answer(h, s, q, { scope: 'firm_template', intent: 'Standard firm wording.' });
  expect(r.status).toBe(200);
  return {
    ws: s.workspaceId,
    q,
    answerId: r.body.answer_id as string,
    decisionId: r.body.decision.id as string,
  };
}

describe('variance-answer-append-only (AC-V14)', () => {
  test('should keep every old guarded column and the new intent, scope, owner columns immutable', async () => {
    const { ws, q, answerId, decisionId } = await answered();
    // counsel_answer: old columns (0002) plus intent, scope
    for (const set of [
      "option = 'B'",
      "note = 'edited'",
      "answered_by_name = 'X'",
      'answered_at = 1',
      "question_id = 'x'",
      "intent = 'edited intent'",
      'intent = NULL',
      "scope = 'fund'",
      'scope = NULL',
    ])
      expect(await upd('counsel_answer', ws, answerId, set), `answer ${set}`).toContain(
        'answer_immutable',
      );
    // decision: old columns (0002) plus intent, scope
    for (const set of [
      "note = 'edited'",
      "counsel_option = 'B'",
      "counsel_note = 'x'",
      "fund_name = 'X'",
      'decided_at = 99',
      "issue_class = 'placeholder'",
      'fp_version = 2',
      "intent = 'edited intent'",
      'intent = NULL',
      "scope = 'fund'",
    ])
      expect(await upd('decision', ws, decisionId, set), `decision ${set}`).toContain(
        'decision_immutable',
      );
    // question owner columns are written once
    for (const set of ["owner = 'gp'", 'owner = NULL', "owner_source = 'override'"])
      expect(await upd('counsel_question', ws, q.questionId, set), `question ${set}`).toContain(
        'question_owner_immutable',
      );
  });

  test('the allowed transitions still work after the guards were recreated', async () => {
    const { ws, q, answerId, decisionId } = await answered();
    expect(
      await upd(
        'counsel_answer',
        ws,
        answerId,
        "status = 'revoked', revoked_at = 5, revoke_reason = 'r'",
      ),
    ).toBe('');
    expect(
      await upd(
        'decision',
        ws,
        decisionId,
        "status = 'revoked', revoked_at = 5, revoke_reason = 'r', revoked_by_name = 'T'",
      ),
    ).toBe('');
    // other counsel_question columns stay writable (status/export flow), owner unchanged
    expect(await upd('counsel_question', ws, q.questionId, "status = 'exported'")).toBe('');
    const row = await db
      .prepare(
        'SELECT owner, owner_source FROM counsel_question WHERE workspace_id = ?1 AND id = ?2',
      )
      .bind(ws, q.questionId)
      .first();
    expect(row).toEqual({ owner: 'counsel', owner_source: 'suggested' });
  });

  test('a replayed question with another owner does not change the stored owner', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { extra: { owner: 'gp', owner_source: 'suggested' } });
    const again = await call(
      h,
      'POST',
      '/api/counsel/questions',
      {
        client_op_id: op('q'),
        finding_ref: q.findingRef,
        fingerprint: q.fp,
        interpretations: ['a', 'b'],
        owner: 'counsel',
        owner_source: 'override',
      },
      { cookie: s.cookie },
    );
    expect(again.status).toBe(200);
    expect(again.body.question_id).toBe(q.questionId);
    const rows = await db
      .prepare('SELECT owner FROM counsel_question WHERE workspace_id = ?1 AND id = ?2')
      .bind(s.workspaceId, q.questionId)
      .first();
    expect(rows).toEqual({ owner: 'gp' });
  });
});
