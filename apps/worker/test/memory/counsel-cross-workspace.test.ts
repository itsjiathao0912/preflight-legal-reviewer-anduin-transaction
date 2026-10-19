// Counsel share link isolation (19-10-26): counsel of W1 can never read or write W2; the
// workspace comes from the verified counsel cookie only (body fields are ignored).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { ANALYST_SHEET, counselFor } from './counsel-harness';
import { CounselSheetResponseSchema } from '@aduin/core';
import { call, decide, makeMem, newRun, op, session } from './memory-harness';
import { answerBody, askQuestion } from './variance-harness';

describe('counsel-cross-workspace', () => {
  test('counsel of W1 cannot read or write W2 questions', async () => {
    const h = makeMem();
    const w1 = await session(h, 'Ann (simulated analyst)');
    const w2 = await session(h, 'Ben (simulated analyst)');
    const q1 = await askQuestion(h, w1);
    const q2 = await askQuestion(h, w2);
    const counsel = await counselFor(h, w1);

    const sheet = await call(h, 'GET', '/api/counsel/sheet', undefined, { cookie: counsel });
    expect(sheet.body.questions.map((q: { id: string }) => q.id)).toEqual([q1.questionId]);
    expect(JSON.stringify(sheet.body)).not.toContain(q2.questionId);

    const list = await call(
      h,
      'GET',
      `/api/counsel/comments?question_id=${q2.questionId}`,
      undefined,
      {
        cookie: counsel,
      },
    );
    expect(list.status).toBe(400);
    expect(list.body.error.reason).toBe('question_not_found');

    const post = await call(
      h,
      'POST',
      '/api/counsel/comments',
      {
        question_id: q2.questionId,
        body: 'cross',
        client_op_id: op('x'),
        workspace_id: w2.workspaceId,
      },
      { cookie: counsel },
    );
    expect(post.status).toBe(400);
    expect(post.body.error.reason).toBe('question_not_found');

    const ans = await call(
      h,
      'POST',
      '/api/counsel/answers',
      { ...answerBody(q2), workspace_id: w2.workspaceId },
      { cookie: counsel },
    );
    expect(ans.status).toBe(400);
    expect(ans.body.error.reason).toBe('question_not_found');

    // a body workspace_id on a valid W1 question is ignored: the comment lands in W1
    const okPost = await call(
      h,
      'POST',
      '/api/counsel/comments',
      {
        question_id: q1.questionId,
        body: 'mine',
        client_op_id: op('x'),
        workspace_id: w2.workspaceId,
      },
      { cookie: counsel },
    );
    expect(okPost.status).toBe(200);
    const inW2 = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM counsel_comment WHERE workspace_id = ?1',
    )
      .bind(w2.workspaceId)
      .first<{ n: number }>();
    expect(inW2?.n).toBe(0);
    const inW2Ans = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM counsel_answer WHERE workspace_id = ?1',
    )
      .bind(w2.workspaceId)
      .first<{ n: number }>();
    expect(inW2Ans?.n).toBe(0);

    // the W2 analyst sees nothing of W1
    const w2Sheet = await call(h, 'GET', ANALYST_SHEET, undefined, { cookie: w2.cookie });
    expect(JSON.stringify(w2Sheet.body)).not.toContain(q1.questionId);
    expect(w2Sheet.body.comments).toEqual([]);
  });

  test('sheet decisions[]: active decisions of the own workspace only, doc_ref per actor', async () => {
    const h = makeMem();
    const w1 = await session(h, 'Ann (simulated analyst)');
    const w2 = await session(h, 'Ben (simulated analyst)');
    const r1 = await newRun(h, w1);
    const r2 = await newRun(h, w2);
    const d1 = await decide(h, w1, { runId: r1, quote: 'w1 quote', decision: 'accepted' });
    const d2 = await decide(h, w2, { runId: r2, quote: 'w2 quote' });
    expect(d1.status).toBe(200);
    expect(d2.status).toBe(200);
    const counsel = await counselFor(h, w1);
    const cs = CounselSheetResponseSchema.parse(
      (await call(h, 'GET', '/api/counsel/sheet?doc_ref=sample:01', undefined, { cookie: counsel }))
        .body,
    );
    expect(cs.role).toBe('counsel');
    // counsel's doc ref comes from its signed cookie; the query is ignored
    expect(cs.doc_ref).toBe('package:hartwell');
    // the sandbox copy carries seeded demo decisions too; all are W1's and active
    const own = cs.decisions.find((d) => d.id === d1.body.decision.id);
    expect(own?.decision).toBe('accepted');
    expect(cs.decisions.every((d) => d.status === 'active')).toBe(true);
    expect(JSON.stringify(cs)).not.toContain(d2.body.decision.id);
    const an = CounselSheetResponseSchema.parse(
      (
        await call(h, 'GET', '/api/counsel/sheet?doc_ref=sample:01', undefined, {
          cookie: w1.cookie,
        })
      ).body,
    );
    expect(an.doc_ref).toBe('sample:01');
    expect(an.decisions.map((d) => d.id)).toEqual(cs.decisions.map((d) => d.id));
    // the analyst must name a valid doc ref
    for (const path of ['/api/counsel/sheet', '/api/counsel/sheet?doc_ref=upload:x']) {
      const bad = await call(h, 'GET', path, undefined, { cookie: w1.cookie });
      expect(bad.status).toBe(400);
      expect(bad.body.error.reason).toBe('doc_ref');
    }
  });
});
