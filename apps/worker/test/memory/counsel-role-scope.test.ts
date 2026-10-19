// Counsel share link role scope (19-10-26): the counsel cookie is accepted ONLY by the sheet, the
// answers route and the comments routes; every other memory route refuses it. Counsel answers are
// fund-scope only and are recorded under the counsel's name.
import { env } from 'cloudflare:test';
import {
  CounselCommentListResponseSchema,
  CounselCommentPostResponseSchema,
  CounselReadyResponseSchema,
  CounselSheetResponseSchema,
} from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { ANALYST_SHEET, counselFor } from './counsel-harness';
import {
  call,
  decisionBody,
  makeMem,
  newRun,
  op,
  session,
  type MemHarness,
} from './memory-harness';
import { answerBody, askQuestion } from './variance-harness';

async function setup(h: MemHarness) {
  const s = await session(h);
  const q = await askQuestion(h, s);
  const counsel = await counselFor(h, s, 'Rita Okafor');
  return { s, q, counsel };
}

describe('counsel-role-scope', () => {
  test('counsel can read the sheet, answer and comment', async () => {
    const h = makeMem();
    const { s, q, counsel } = await setup(h);
    const sh = await call(h, 'GET', '/api/counsel/sheet', undefined, { cookie: counsel });
    expect(sh.status).toBe(200);
    const sheet = CounselSheetResponseSchema.parse(sh.body);
    expect(sheet.role).toBe('counsel');
    expect(sheet.questions.map((x) => x.id)).toEqual([q.questionId]);
    expect(sheet.questions[0]!.fingerprint).toBe(q.fp);
    expect(sheet.ready_at).toBeNull();

    // counsel has no document: quote_text in the body is ignored (the stored quote is used)
    const a = await call(
      h,
      'POST',
      '/api/counsel/answers',
      answerBody(q, { quote_text: 'masked quote only', note: 'Option A per LPA 4.2' }),
      { cookie: counsel },
    );
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body.decision.decided_by_name).toBe('Counsel: Rita Okafor');
    const row = await env.DB.prepare(
      'SELECT answered_by_name FROM counsel_answer WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, a.body.answer_id)
      .first<{ answered_by_name: string }>();
    expect(row?.answered_by_name).toBe('Rita Okafor');
    const audit = await env.DB.prepare(
      "SELECT actor_name FROM audit_event WHERE workspace_id = ?1 AND action = 'answer_recorded'",
    )
      .bind(s.workspaceId)
      .first<{ actor_name: string }>();
    expect(audit?.actor_name).toBe('Counsel: Rita Okafor');
    // a counsel answer with a wrong fingerprint is still refused
    const badFp = await call(
      h,
      'POST',
      '/api/counsel/answers',
      answerBody(q, { fingerprint: 'f'.repeat(64) }),
      {
        cookie: counsel,
      },
    );
    expect(badFp.status).toBe(422);

    const c = await call(
      h,
      'POST',
      '/api/counsel/comments',
      {
        question_id: q.questionId,
        body: 'Please confirm the feeder wording.',
        client_op_id: op('cm'),
      },
      { cookie: counsel },
    );
    expect(c.status).toBe(200);
    expect(CounselCommentPostResponseSchema.parse(c.body).comment).toMatchObject({
      author_role: 'counsel',
      author_name: 'Rita Okafor',
      question_id: q.questionId,
    });
    const ac = await call(
      h,
      'POST',
      '/api/counsel/comments',
      { question_id: q.questionId, body: 'Thanks, noted.', client_op_id: op('cm') },
      { cookie: s.cookie },
    );
    expect(ac.status).toBe(200);
    expect(ac.body.comment.author_role).toBe('analyst');
    const list = await call(
      h,
      'GET',
      `/api/counsel/comments?question_id=${q.questionId}`,
      undefined,
      {
        cookie: counsel,
      },
    );
    expect(
      CounselCommentListResponseSchema.parse(list.body).comments.map((x) => x.author_role),
    ).toEqual(['counsel', 'analyst']);
    // the analyst sheet shows the counsel answer and both comments
    const an = CounselSheetResponseSchema.parse(
      (await call(h, 'GET', ANALYST_SHEET, undefined, { cookie: s.cookie })).body,
    );
    expect(an.role).toBe('analyst');
    expect(
      an.answers.some(
        (x) => x.answered_by_name === 'Rita Okafor' && x.note === 'Option A per LPA 4.2',
      ),
    ).toBe(true);
    expect(an.comments).toHaveLength(2);
    // ?since= returns only newer answers/comments
    const later = await call(h, 'GET', `${ANALYST_SHEET}&since=${h.clock.now}`, undefined, {
      cookie: s.cookie,
    });
    expect(later.body.answers).toEqual([]);
    expect(later.body.comments).toEqual([]);
    expect(later.body.questions).toHaveLength(1);
    expect(
      (await call(h, 'GET', `${ANALYST_SHEET}&since=abc`, undefined, { cookie: s.cookie })).status,
    ).toBe(400);
  });

  test('every other route refuses the counsel cookie', async () => {
    const h = makeMem();
    const { s, q, counsel } = await setup(h);
    const run = await newRun(h, s);
    const posts: [string, unknown][] = [
      ['/api/decisions', decisionBody({ runId: run, quote: 'Counsel must not decide.' })],
      ['/api/rules?law_firm_id=firm-x', { client_op_id: op(), text: 'Counsel rule' }],
      [`/api/runs/${run}/export`, { client_op_id: op() }],
      ['/api/runs', { client_op_id: op() }],
      [`/api/runs/${run}/findings`, { client_op_id: op(), findings: [] }],
      [
        '/api/counsel/questions',
        {
          client_op_id: op(),
          finding_ref: q.findingRef,
          fingerprint: q.fp,
          interpretations: ['a'],
        },
      ],
      ['/api/counsel/ready', { client_op_id: op() }],
      ['/api/counsel/share', { doc_ref: 'package:hartwell' }],
      ['/api/memory/lookup', { law_firm_id: 'firm-x', fingerprints: [q.fp] }],
      ['/api/decisions/x1/revoke', { client_op_id: op(), reason: 'x' }],
      ['/api/rules/x1/approve', { client_op_id: op() }],
    ];
    for (const [path, body] of posts) {
      const r = await call(h, 'POST', path, body, { cookie: counsel });
      expect(r.status, path).toBe(401);
      expect(r.body.error.code, path).toBe('invalid_session');
    }
    for (const path of [
      '/api/audit?limit=5',
      '/api/export',
      '/api/memory/firm?law_firm_id=firm-x',
      '/api/rules?law_firm_id=firm-x',
    ]) {
      const r = await call(h, 'GET', path, undefined, { cookie: counsel });
      expect(r.status, path).toBe(401);
    }
  });

  test('counsel answers are fund-scope only (no firm_template, no assertion)', async () => {
    const h = makeMem();
    const { q, counsel } = await setup(h);
    for (const extra of [
      { scope: 'firm_template', intent: 'Applies to every fund' },
      {
        scope: 'firm_template',
        intent: 'x',
        assertion: { kind: 'scope_exists', label: 'Appendix C' },
      },
    ]) {
      const r = await call(h, 'POST', '/api/counsel/answers', answerBody(q, extra), {
        cookie: counsel,
      });
      expect(r.status, JSON.stringify(extra)).toBe(400);
      expect(r.body.error.reason).toBe('counsel_scope');
    }
    const fund = await call(
      h,
      'POST',
      '/api/counsel/answers',
      answerBody(q, { scope: 'fund', intent: 'Fund only' }),
      {
        cookie: counsel,
      },
    );
    expect(fund.status).toBe(200);
  });

  test('ready: analyst only, one idempotent ready_to_digitize audit event, visible in sheet and audit', async () => {
    const h = makeMem();
    const { s, counsel } = await setup(h);
    const opId = op('ready');
    const r = await call(
      h,
      'POST',
      '/api/counsel/ready',
      { client_op_id: opId },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(200);
    const { ready_at } = CounselReadyResponseSchema.parse(r.body);
    const again = await call(
      h,
      'POST',
      '/api/counsel/ready',
      { client_op_id: opId },
      { cookie: s.cookie },
    );
    expect(again.status).toBe(200);
    expect(again.body.ready_at).toBe(ready_at);
    const n = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action = 'ready_to_digitize'",
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
    const sh = await call(h, 'GET', '/api/counsel/sheet', undefined, { cookie: counsel });
    expect(sh.body.ready_at).toBe(ready_at);
    const au = await call(h, 'GET', '/api/audit?limit=50', undefined, { cookie: s.cookie });
    expect(au.body.events.some((e: { action: string }) => e.action === 'ready_to_digitize')).toBe(
      true,
    );
  });
});
