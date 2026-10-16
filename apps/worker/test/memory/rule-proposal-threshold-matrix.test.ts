// AC53 + D-5: >= 3 distinct active same-(firm, pattern_key, reason) dismissals propose a rule;
// 2, mixed reasons, another firm, or `other` do not; a rejected key is re-proposed only on NEW
// evidence; an active rule is never duplicated; a revoked decision leaves the count.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import {
  call,
  decide,
  makeMem,
  newRun,
  op,
  session,
  type MemHarness,
  type Session,
} from './memory-harness';

let n = 0;
async function dismiss(
  h: MemHarness,
  s: Session,
  run: string,
  pk: string,
  reason:
    'firm_standard_wording' | 'no_form_impact' | 'tool_false_alarm' | 'other' = 'no_form_impact',
) {
  n++;
  const r = await decide(h, s, {
    runId: run,
    quote: `Distinct quote number ${n} for ${pk}.`,
    reason,
    patternKey: pk,
  });
  expect(r.status).toBe(200);
  return r.body.decision.id as string;
}

async function proposals(ws: string, pk: string) {
  return (
    await env.DB.prepare(
      'SELECT id, status, (SELECT COUNT(*) FROM rule_evidence e WHERE e.workspace_id = r.workspace_id AND e.rule_id = r.id) AS ev FROM firm_rule r WHERE workspace_id = ?1 AND proposal_key LIKE ?2 ORDER BY created_at, id',
    )
      .bind(ws, `${pk}|%`)
      .all<{ id: string; status: string; ev: number }>()
  ).results;
}

describe('rule-proposal-threshold-matrix (AC53, D-5)', () => {
  test('should propose a rule on the third same-reason dismissal and not on the second', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await dismiss(h, s, run, 'tp:third');
    await dismiss(h, s, run, 'tp:third');
    expect(await proposals(s.workspaceId, 'tp:third')).toEqual([]);
    await dismiss(h, s, run, 'tp:third');
    const p = await proposals(s.workspaceId, 'tp:third');
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ status: 'proposed', ev: 3 });
    await dismiss(h, s, run, 'tp:third'); // a 4th appends evidence, never a 2nd proposal
    expect(await proposals(s.workspaceId, 'tp:third')).toEqual([{ ...p[0], ev: 4 }]);
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action = 'rule_proposed' AND entity_id = ?2",
    )
      .bind(s.workspaceId, p[0]!.id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
    const list = await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, {
      cookie: s.cookie,
    });
    expect(list.body.rules.find((r: { id: string }) => r.id === p[0]!.id)).toMatchObject({
      origin: 'proposal',
      status: 'proposed',
      evidence_count: 4,
    });
  });

  test('mixed reasons, `other`, and another firm never reach the threshold', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    await dismiss(h, s, run, 'tp:mixed', 'no_form_impact');
    await dismiss(h, s, run, 'tp:mixed', 'tool_false_alarm');
    await dismiss(h, s, run, 'tp:mixed', 'firm_standard_wording');
    expect(await proposals(s.workspaceId, 'tp:mixed')).toEqual([]);
    for (let i = 0; i < 3; i++) await dismiss(h, s, run, 'tp:other', 'other');
    expect(await proposals(s.workspaceId, 'tp:other')).toEqual([]);
    const runY = await newRun(h, s, 'firm-y');
    await dismiss(h, s, run, 'tp:firm');
    await dismiss(h, s, run, 'tp:firm');
    n++;
    await decide(h, s, {
      runId: runY,
      quote: `Firm Y quote ${n}.`,
      reason: 'no_form_impact',
      patternKey: 'tp:firm',
      firm: 'firm-y',
    });
    expect(await proposals(s.workspaceId, 'tp:firm')).toEqual([]);
  });

  test('should re-propose a rejected rule only after new same-reason dismissals', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    for (let i = 0; i < 3; i++) await dismiss(h, s, run, 'tp:reject');
    const [p] = await proposals(s.workspaceId, 'tp:reject');
    const rj = await call(
      h,
      'POST',
      `/api/rules/${p!.id}/reject`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(rj.status).toBe(200);
    // no new same-key/same-reason evidence -> no re-proposal
    await dismiss(h, s, run, 'tp:reject', 'tool_false_alarm');
    await dismiss(h, s, run, 'tp:reject', 'other');
    n++;
    await decide(h, s, {
      runId: run,
      quote: `Accepted with the same key ${n}.`,
      decision: 'accepted',
      patternKey: 'tp:reject',
    });
    expect((await proposals(s.workspaceId, 'tp:reject')).map((r) => r.status)).toEqual([
      'rejected',
    ]);
    // +1 new same-reason dismissal -> re-proposal carrying ALL current evidence (3 old + 1 new)
    await dismiss(h, s, run, 'tp:reject');
    const after = await proposals(s.workspaceId, 'tp:reject');
    expect(after.map((r) => r.status)).toEqual(['rejected', 'proposed']);
    expect(after[1]!.ev).toBe(4);
  });

  test('an active rule is never duplicated; a revoked decision leaves the count', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    for (let i = 0; i < 3; i++) await dismiss(h, s, run, 'tp:active');
    const [p] = await proposals(s.workspaceId, 'tp:active');
    expect(
      (
        await call(
          h,
          'POST',
          `/api/rules/${p!.id}/approve`,
          { client_op_id: op() },
          { cookie: s.cookie },
        )
      ).status,
    ).toBe(200);
    await dismiss(h, s, run, 'tp:active');
    expect((await proposals(s.workspaceId, 'tp:active')).map((r) => [r.status, r.ev])).toEqual([
      ['active', 3],
    ]);
    // revoked decisions do not count
    const d1 = await dismiss(h, s, run, 'tp:revoked');
    await dismiss(h, s, run, 'tp:revoked');
    await call(
      h,
      'POST',
      `/api/decisions/${d1}/revoke`,
      { client_op_id: op(), reason: 'reopen' },
      { cookie: s.cookie },
    );
    await dismiss(h, s, run, 'tp:revoked');
    expect(await proposals(s.workspaceId, 'tp:revoked')).toEqual([]);
    await dismiss(h, s, run, 'tp:revoked');
    expect((await proposals(s.workspaceId, 'tp:revoked')).map((r) => r.ev)).toEqual([3]);
  });

  test('pattern keys outside the E6 charset are rejected (400)', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const r = await decide(h, s, { runId: run, quote: 'Bad key.', patternKey: 'Bad|Key' });
    expect(r.status).toBe(400);
    expect(r.body.error.reason).toBe('pattern_key');
  });
});
