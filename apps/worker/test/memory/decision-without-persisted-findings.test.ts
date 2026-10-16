// AC42 tiering: decisions, counsel answers and finding_state succeed when no finding rows were
// persisted (the best-effort findings tier was skipped).
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { call, decide, fpOf, lookup, makeMem, newRun, op, session } from './memory-harness';

describe('decision-without-persisted-findings (AC42)', () => {
  test('should record a decision when no finding rows were persisted', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'No finding row was ever stored for this one.';
    const d = await decide(h, s, {
      runId: run,
      quote,
      decision: 'accepted',
      cls: 'ambiguity',
      findingRef: 'np-1',
    });
    expect(d.status).toBe(200);
    const findings = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM finding WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(findings!.n).toBe(0);
    const st = await env.DB.prepare(
      'SELECT status, needs_counsel FROM finding_state WHERE workspace_id = ?1 AND review_run_id = ?2 AND finding_key = ?3',
    )
      .bind(s.workspaceId, run, 'np-1')
      .first();
    expect(st).toEqual({ status: 'accepted', needs_counsel: 1 });
    const fp = fpOf('firm-x', 'ambiguity', quote);
    const q = await call(
      h,
      'POST',
      '/api/counsel/questions',
      { client_op_id: op(), finding_ref: 'np-1', fingerprint: fp, interpretations: ['One', 'Two'] },
      { cookie: s.cookie },
    );
    expect(q.status).toBe(200);
    const a = await call(
      h,
      'POST',
      '/api/counsel/answers',
      {
        client_op_id: op(),
        question_id: q.body.question_id,
        option: 'C',
        quote_text: quote,
        fingerprint: fp,
      },
      { cookie: s.cookie },
    );
    expect(a.status).toBe(200);
    expect((await lookup(h, s, 'firm-x', [fp])).body.decisions[0]).toMatchObject({
      decision: 'answered',
      counsel_option: 'C',
    });
    const st2 = await env.DB.prepare(
      'SELECT status FROM finding_state WHERE workspace_id = ?1 AND finding_key = ?2',
    )
      .bind(s.workspaceId, 'np-1')
      .first<{ status: string }>();
    expect(st2!.status).toBe('answered');
  });
});
