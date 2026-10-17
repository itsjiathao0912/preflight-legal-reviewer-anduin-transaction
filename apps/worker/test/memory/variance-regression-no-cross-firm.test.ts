// AC-V16 (server part): a regression check is created only from a firm_template answer with an
// assertion; the lookup returns checks of the caller's workspace AND the looked-up firm only; the
// per-firm cap holds (route pre-check + trigger backstop, three-way literal parity); the label is
// re-normalized server-side; a replay (also at the cap, N1) creates no second check; the derived
// audit op id `<op>#rc` cannot collide with a client id (N4).
import { env } from 'cloudflare:test';
import { limits, loadVarianceRules } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { classifyBatchError, TRIGGER_INVALID_REQUEST, TRIGGER_TEXTS } from '../../src/db/tx';
import { errorOf } from './db-fixtures';
import { call, lookup, makeMem, session, type MemHarness, type Session } from './memory-harness';
import { answer, answerBody, askQuestion, withAssertion } from './variance-harness';

const FIRM = 'hartwell-crane';
const FP = 'f'.repeat(64);
const code = (b: unknown) => (b as { error?: { code?: string } }).error?.code;
const checksOf = (b: unknown) =>
  (b as { regression_checks?: { assertion_key: string; source_fund_name: string }[] })
    .regression_checks ?? [];

async function recordCheck(
  h: MemHarness,
  s: Session,
  label = 'Appendix C',
  o: { firm?: string; fund?: string; clientOpId?: string } = {},
) {
  const q = await askQuestion(h, s, { firm: o.firm ?? FIRM, fund: o.fund ?? 'Northgate Fund I' });
  expect(q.status).toBe(200);
  const body = answerBody(q, withAssertion(label));
  if (o.clientOpId) body['client_op_id'] = o.clientOpId;
  const r = await call(h, 'POST', '/api/counsel/answers', body, { cookie: s.cookie });
  return { q, r, body };
}

const countChecks = (ws: string, firm = FIRM) =>
  env.DB.prepare(
    "SELECT COUNT(*) AS n FROM regression_check WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active'",
  )
    .bind(ws, firm)
    .first<{ n: number }>()
    .then((r) => r?.n ?? 0);

describe('variance-regression-no-cross-firm (AC-V16)', () => {
  test('should never return a regression check of another firm or workspace', async () => {
    const h = makeMem();
    const a = await session(h);
    const b = await session(h);
    const { r } = await recordCheck(h, a, 'SUBSCRIPTION AGREEMENT  APPENDIX   C');
    expect(r.status).toBe(200);
    const same = await lookup(h, a, FIRM, [FP]);
    expect(same.status).toBe(200);
    expect(checksOf(same.body)).toEqual([
      {
        id: expect.stringMatching(/^rc_/),
        assertion_kind: 'scope_exists',
        assertion_key: 'appendix c',
        statement_text: 'Appendix C must exist',
        source_fund_name: 'Northgate Fund I',
      },
    ]);
    // another firm in the same workspace, and the same firm in another workspace: none
    expect(checksOf((await lookup(h, a, 'firm-x', [FP])).body)).toEqual([]);
    expect(checksOf((await lookup(h, a, 'ostrander-pell', [FP])).body)).toEqual([]);
    expect(checksOf((await lookup(h, b, FIRM, [FP])).body)).toEqual([]);
    // an unknown firm returns no checks at all
    expect((await lookup(h, a, 'sutter-lane', [FP])).body.regression_checks).toBeUndefined();
  });

  test('a check cannot reference another workspace answer (composite foreign key)', async () => {
    const h = makeMem();
    const a = await session(h);
    const b = await session(h);
    const { r } = await recordCheck(h, a);
    const err = await errorOf(
      env.DB.prepare(
        "INSERT INTO regression_check (workspace_id, id, law_firm_id, source_answer_id, source_fund_name, assertion_kind, assertion_key, statement_text, created_at) VALUES (?1, 'rc_forged', ?2, ?3, 'F', 'scope_exists', 'appendix c', 'Appendix C must exist', 1)",
      )
        .bind(b.workspaceId, FIRM, r.body.answer_id)
        .run(),
    );
    expect(err).toContain('FOREIGN KEY constraint failed');
  });

  test('the check and its audit row share the answer batch; the derived op id is <op>#rc', async () => {
    const h = makeMem();
    const s = await session(h);
    const { r, body } = await recordCheck(h, s);
    expect(r.status).toBe(200);
    const rows = await env.DB.prepare(
      "SELECT client_op_id, action, entity_type FROM audit_event WHERE workspace_id = ?1 AND action IN ('answer_recorded','regression_check_created') ORDER BY action",
    )
      .bind(s.workspaceId)
      .all<{ client_op_id: string; action: string; entity_type: string }>();
    expect(rows.results).toEqual([
      {
        client_op_id: body['client_op_id'],
        action: 'answer_recorded',
        entity_type: 'counsel_answer',
      },
      {
        client_op_id: `${body['client_op_id']}#rc`,
        action: 'regression_check_created',
        entity_type: 'regression_check',
      },
    ]);
    const check = await env.DB.prepare(
      'SELECT source_answer_id, law_firm_id FROM regression_check WHERE workspace_id = ?1',
    )
      .bind(s.workspaceId)
      .first();
    expect(check).toEqual({ source_answer_id: r.body.answer_id, law_firm_id: FIRM });
  });

  test('a plain replay creates no second check and no second #rc row', async () => {
    const h = makeMem();
    const s = await session(h);
    const { r, body } = await recordCheck(h, s);
    const again = await call(h, 'POST', '/api/counsel/answers', body, { cookie: s.cookie });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(r.body);
    expect(await countChecks(s.workspaceId)).toBe(1);
    const rc = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_event WHERE workspace_id = ?1 AND action = 'regression_check_created'",
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(rc?.n).toBe(1);
  });

  test('forged X:rc is an ordinary id and X#rc is refused; neither collides with the derived id', async () => {
    const h = makeMem();
    const s = await session(h);
    const x = `forge-${Math.floor(Math.random() * 1e9)}`;
    const forged = await recordCheck(h, s, 'Appendix D', { clientOpId: `${x}:rc` });
    expect(forged.r.status).toBe(200);
    const hashed = await recordCheck(h, s, 'Appendix E', { clientOpId: `${x}#rc` });
    expect(hashed.r.status).toBe(400);
    expect(code(hashed.r.body)).toBe('invalid_request');
    const real = await recordCheck(h, s, 'Appendix F', { clientOpId: x });
    expect(real.r.status).toBe(200);
    const ops = await env.DB.prepare(
      "SELECT client_op_id FROM audit_event WHERE workspace_id = ?1 AND action = 'regression_check_created' ORDER BY client_op_id",
    )
      .bind(s.workspaceId)
      .all<{ client_op_id: string }>();
    expect(ops.results.map((o) => o.client_op_id).sort()).toEqual([`${x}#rc`, `${x}:rc#rc`].sort());
    expect(await countChecks(s.workspaceId)).toBe(2);
  });

  test('should refuse over the cap, and answer a replay at the cap with the stored result', async () => {
    const h = makeMem();
    const s = await session(h);
    const cap = limits.regressionChecksPerFirm;
    let first: Awaited<ReturnType<typeof recordCheck>> | null = null;
    for (let i = 0; i < cap; i++) {
      const rec = await recordCheck(h, s, `Appendix ${String.fromCharCode(65 + i)}`);
      expect(rec.r.status, `check ${i}`).toBe(200);
      first ??= rec;
    }
    expect(await countChecks(s.workspaceId)).toBe(cap);
    const over = await recordCheck(h, s, 'Appendix Z');
    expect(over.r.status).toBe(400);
    expect(code(over.r.body)).toBe('invalid_request');
    expect(JSON.stringify(over.r.body)).toContain('regression_check_cap');
    // N1: the replay of an already-recorded answer at the cap returns the original success
    const replay = await call(h, 'POST', '/api/counsel/answers', first!.body, { cookie: s.cookie });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first!.r.body);
    expect(await countChecks(s.workspaceId)).toBe(cap);
    // another firm in the same workspace still has room (cap is per firm)
    const other = await recordCheck(h, s, 'Appendix C', { firm: 'firm-x' });
    expect(other.r.status).toBe(200);
    // trigger backstop: a direct insert over the cap aborts with the cap text
    const err = await errorOf(
      env.DB.prepare(
        "INSERT INTO regression_check (workspace_id, id, law_firm_id, source_answer_id, source_fund_name, assertion_kind, assertion_key, statement_text, created_at) VALUES (?1, 'rc_over', ?2, ?3, 'F', 'scope_exists', 'appendix z', 'Appendix Z must exist', 1)",
      )
        .bind(s.workspaceId, FIRM, first!.r.body.answer_id)
        .run(),
    );
    expect(err).toContain('regression_check_cap');
    expect(classifyBatchError(new Error(err))).toEqual({
      kind: 'trigger',
      trigger: 'regression_check_cap',
    });
  });

  test('cap parity: trigger literal = limits.regressionChecksPerFirm = rules regression.max_checks_per_firm', () => {
    const sql = env.TEST_MIGRATIONS.flatMap((m) => m.queries).find((q) =>
      q.includes("RAISE(ABORT, 'regression_check_cap')"),
    );
    const literal = Number(/\)\s*>=\s*(\d+)/.exec(sql ?? '')?.[1]);
    expect(literal).toBe(limits.regressionChecksPerFirm);
    expect(loadVarianceRules().config.regression.max_checks_per_firm).toBe(literal);
    expect(literal).toBe(20);
  });

  test('every new 0006 trigger text maps to a typed invalid_request class, never to other (503)', () => {
    for (const t of [
      'regression_check_immutable',
      'regression_check_append_only',
      'regression_check_cap',
      'question_owner_immutable',
    ] as const) {
      expect(TRIGGER_TEXTS).toContain(t);
      expect(classifyBatchError(new Error(`D1_ERROR: ${t}: SQLITE_CONSTRAINT`))).toEqual({
        kind: 'trigger',
        trigger: t,
      });
      expect(TRIGGER_INVALID_REQUEST.has(t)).toBe(true);
    }
    // no new text contains, or sits inside, another entry (substring matching stays unambiguous)
    for (const a of TRIGGER_TEXTS)
      for (const b of TRIGGER_TEXTS) if (a !== b) expect(a.includes(b), `${a} / ${b}`).toBe(false);
  });

  test('a check is never created without firm_template (assertion with scope fund is refused)', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: FIRM });
    const r = await answer(h, s, q, {
      scope: 'fund',
      assertion: { kind: 'scope_exists', label: 'Appendix C' },
    });
    expect(r.status).toBe(400);
    expect(await countChecks(s.workspaceId)).toBe(0);
  });
});
