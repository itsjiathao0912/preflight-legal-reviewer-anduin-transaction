// Every decision type x reason x option: the DB accepts exactly the valid combinations, and every
// API-written decision carries the full record (exhaustive test.each; no fast-check dependency).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { decisionRow, errorOf, insertDecision, mkWorkspace } from './db-fixtures';
import { call, decide, decisionBody, fpOf, makeMem, newRun, op, session } from './memory-harness';

const COUNSEL_OPTIONS_FOR_TEST = ['A', 'B', 'C', 'unclear'] as const;
const DECISIONS = ['dismissed', 'accepted', 'answered'] as const;
const REASONS = [
  'firm_standard_wording',
  'no_form_impact',
  'tool_false_alarm',
  'other',
  null,
] as const;
const OPTIONS = [...COUNSEL_OPTIONS_FOR_TEST, null] as const;
const MATRIX = DECISIONS.flatMap((d) =>
  REASONS.flatMap((r) => OPTIONS.map((o) => [d, r, o] as const)),
);

describe('decision-record-contract (AC42, AC6)', () => {
  test.each(MATRIX)('DB: decision=%s reason=%s option=%s', async (decision, reason, option) => {
    const ws = await mkWorkspace(env.DB);
    const err = await errorOf(
      insertDecision(
        env.DB,
        decisionRow(ws, { decision, reason_code: reason, counsel_option: option }),
      ),
    );
    const valid =
      (decision !== 'dismissed' || reason !== null) && (decision !== 'answered' || option !== null);
    if (valid) expect(err).toBe('');
    else expect(err).toContain('CHECK constraint failed');
  });

  const h = makeMem();
  test.each([
    ...REASONS.filter((r) => r !== null).map((r) => ['dismissed', r] as const),
    ['accepted', null] as const,
  ])('API: %s (%s) stores the full record', async (decision, reason) => {
    const s = await session(h);
    const run = await newRun(h, s, 'firm-x', 'Fund Record');
    const quote = `Record contract quote for ${decision} ${reason ?? ''}.`;
    const r = await decide(h, s, {
      runId: run,
      quote,
      decision,
      ...(reason ? { reason } : {}),
      note: 'A note.',
      patternKey: 'record:contract',
      findingRef: 'fr-1',
    });
    expect(r.status).toBe(200);
    const row = await env.DB.prepare('SELECT * FROM decision WHERE workspace_id = ?1 AND id = ?2')
      .bind(s.workspaceId, r.body.decision.id)
      .first<Record<string, unknown>>();
    expect(row).toMatchObject({
      law_firm_id: 'firm-x',
      fingerprint: fpOf('firm-x', 'defined_term_issue', quote),
      fp_version: 1,
      issue_class: 'defined_term_issue',
      pattern_key: 'record:contract',
      fund_name: 'Fund Record',
      doc_version_label: 'v1',
      origin_review_run_id: run,
      origin_finding_key: 'fr-1',
      decision,
      reason_code: reason,
      note: 'A note.',
      decided_by_analyst_id: s.analystId,
      decided_by_name: 'Dana (simulated analyst)',
      status: 'active',
    });
    expect(row?.['quote_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(String(row?.['quote_snippet'])).toBe(quote);
    expect(row?.['origin_document_id']).toMatch(/^do_/);
    expect(row?.['origin_fund_id']).toMatch(/^fu_/);
    expect(Number(row?.['decided_at'])).toBe(h.clock.now);
  });

  test.each(COUNSEL_OPTIONS_FOR_TEST)(
    'API: answered (%s) via counsel answer stores the full record',
    async (option) => {
      const s = await session(h);
      const run = await newRun(h, s);
      const quote = `Counsel record quote ${option}.`;
      const fp = fpOf('firm-x', 'ambiguity', quote);
      await decide(h, s, {
        runId: run,
        quote,
        decision: 'accepted',
        cls: 'ambiguity',
        findingRef: 'fa',
      });
      const q = await call(
        h,
        'POST',
        '/api/counsel/questions',
        { client_op_id: op(), finding_ref: 'fa', fingerprint: fp, interpretations: ['x'] },
        { cookie: s.cookie },
      );
      const a = await call(
        h,
        'POST',
        '/api/counsel/answers',
        {
          client_op_id: op(),
          question_id: q.body.question_id,
          option,
          note: 'Reply.',
          quote_text: quote,
          fingerprint: fp,
        },
        { cookie: s.cookie },
      );
      expect(a.status).toBe(200);
      const row = await env.DB.prepare(
        'SELECT decision, counsel_option, counsel_note, counsel_answer_id, status FROM decision WHERE workspace_id = ?1 AND id = ?2',
      )
        .bind(s.workspaceId, a.body.decision.id)
        .first();
      expect(row).toEqual({
        decision: 'answered',
        counsel_option: option,
        counsel_note: 'Reply.',
        counsel_answer_id: a.body.answer_id,
        status: 'active',
      });
    },
  );

  test('should return fingerprint_mismatch when the client hash disagrees', async () => {
    const s = await session(h);
    const run = await newRun(h, s);
    const body = decisionBody({ runId: run, quote: 'Original quote.' });
    body['quote_text'] = 'Different quote.';
    const r = await call(h, 'POST', '/api/decisions', body, { cookie: s.cookie });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('fingerprint_mismatch');
    const wrongFirm = decisionBody({ runId: run, quote: 'Q here.', firm: 'firm-y' });
    expect((await call(h, 'POST', '/api/decisions', wrongFirm, { cookie: s.cookie })).status).toBe(
      422,
    );
    const n = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM decision WHERE workspace_id = ?1 AND seed_of IS NULL',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});
