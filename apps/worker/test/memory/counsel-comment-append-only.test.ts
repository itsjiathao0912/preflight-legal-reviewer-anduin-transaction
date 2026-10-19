// Migration 0007 counsel_comment: append-only (UPDATE/DELETE abort outside 'purging'), demo
// workspace inserts blocked, 50-per-question cap (route 429 + trigger backstop), masked body,
// idempotent client_op_id, and the retention purge deletes comments of an expired sandbox.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { PURGE_CHILD_TABLES, runPurge } from '../../src/memory/repo/purge';
import { errorOf } from './db-fixtures';
import { call, DAY_MS, makeMem, op, session } from './memory-harness';
import { askQuestion } from './variance-harness';

const post = (
  h: ReturnType<typeof makeMem>,
  cookie: string,
  question_id: string,
  body: string,
  client_op_id = op('cm'),
) => call(h, 'POST', '/api/counsel/comments', { question_id, body, client_op_id }, { cookie });

describe('counsel-comment-append-only', () => {
  test('UPDATE and DELETE abort with comment_append_only', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s);
    const c = await post(h, s.cookie, q.questionId, 'First comment.');
    expect(c.status).toBe(200);
    const id = c.body.comment.id;
    const upd = await errorOf(
      env.DB.prepare(
        "UPDATE counsel_comment SET body = 'edited' WHERE workspace_id = ?1 AND id = ?2",
      )
        .bind(s.workspaceId, id)
        .run(),
    );
    expect(upd).toContain('comment_append_only');
    const del = await errorOf(
      env.DB.prepare('DELETE FROM counsel_comment WHERE workspace_id = ?1 AND id = ?2')
        .bind(s.workspaceId, id)
        .run(),
    );
    expect(del).toContain('comment_append_only');
  });

  test('the demo workspace refuses comment inserts', async () => {
    const q = await env.DB.prepare(
      "SELECT id FROM counsel_question WHERE workspace_id = 'ws_demo' LIMIT 1",
    ).first<{ id: string }>();
    const err = await errorOf(
      env.DB.prepare(
        "INSERT INTO counsel_comment (workspace_id, id, question_id, author_role, author_name, body, created_at) VALUES ('ws_demo', 'cc_demo', ?1, 'analyst', 'A', 'x', 0)",
      )
        .bind(q?.id ?? 'none')
        .run(),
    );
    expect(err).toContain('demo_read_only');
  });

  test('body is masked; a retried client_op_id returns the stored comment; cap 50 -> 429', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s);
    const opId = op('cm');
    const first = await post(h, s.cookie, q.questionId, 'Wire to account 021000021 please.', opId);
    expect(first.status).toBe(200);
    expect(first.body.comment.body).not.toContain('021000021');
    const replay = await post(h, s.cookie, q.questionId, 'different text', opId);
    expect(replay.status).toBe(200);
    expect(replay.body.comment).toEqual(first.body.comment);
    expect((await post(h, s.cookie, q.questionId, '   ')).status).toBe(400);
    for (let i = 1; i < 50; i++)
      expect((await post(h, s.cookie, q.questionId, `c${i}`)).status).toBe(200);
    const over = await post(h, s.cookie, q.questionId, 'one too many');
    expect(over.status).toBe(429);
    expect(over.body.error).toMatchObject({ code: 'quota_exhausted', reason: 'comment_cap' });
    const backstop = await errorOf(
      env.DB.prepare(
        "INSERT INTO counsel_comment (workspace_id, id, question_id, author_role, author_name, body, created_at) VALUES (?1, 'cc_over', ?2, 'analyst', 'A', 'x', 0)",
      )
        .bind(s.workspaceId, q.questionId)
        .run(),
    );
    expect(backstop).toContain('comment_cap');
  });

  test('purge deletes comments of an expired sandbox (before counsel_question)', async () => {
    expect(PURGE_CHILD_TABLES.indexOf('counsel_comment')).toBeLessThan(
      PURGE_CHILD_TABLES.indexOf('counsel_question'),
    );
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s);
    expect((await post(h, s.cookie, q.questionId, 'to be purged')).status).toBe(200);
    await runPurge(env.DB, h.clock.now + 31 * DAY_MS);
    const left = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM counsel_comment WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
    const ws = await env.DB.prepare('SELECT COUNT(*) AS n FROM workspace WHERE id = ?1')
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(ws?.n).toBe(0);
  });
});
