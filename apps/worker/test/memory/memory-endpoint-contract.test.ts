// Frozen Contracts v1 conformance for every 04b route (A0 derivations, path params, firm alias).
import { env } from 'cloudflare:test';
import {
  AuditResponseSchema,
  CounselAnswerResponseSchema,
  CounselQuestionResponseSchema,
  CreateDecisionResponseSchema,
  CreateRunResponseSchema,
  CreateSessionResponseSchema,
  ExportResponseSchema,
  FirmMemoryResponseSchema,
  MemoryLookupResponseSchema,
  RevokeDecisionResponseSchema,
  RuleActionResponseSchema,
  RulesResponseSchema,
  StoreFindingsResponseSchema,
} from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { RunExportResponseSchema } from '../../src/routes/memory/export';
import {
  call,
  cookieOf,
  decide,
  decisionBody,
  dumpWorkspace,
  fpOf,
  lookup,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
} from './memory-harness';

describe('memory-endpoint-contract (frozen Contracts v1)', () => {
  test('session, run, findings, decision, lookup, revoke parse with the frozen schemas', async () => {
    const h = makeMem();
    const r0 = await call(h, 'POST', '/api/session', { analyst_name: 'Eve (simulated analyst)' });
    expect(r0.status).toBe(200);
    expect(CreateSessionResponseSchema.parse(r0.body)).toMatchObject({
      kind: 'sandbox',
      read_only: false,
    });
    expect(cookieOf(r0.res)).toBeDefined();
    const s = {
      cookie: cookieOf(r0.res)!,
      workspaceId: r0.body.workspace_id,
      analystId: r0.body.analyst_id,
    };

    const run = await newRun(h, s);
    expect(CreateRunResponseSchema.parse({ run_id: run }).run_id).toMatch(/^ru_/);

    const quote = 'The Investor shall subscribe for Units in the Fund.';
    const f = await call(
      h,
      'POST',
      `/api/runs/${run}/findings`,
      { client_op_id: op(), findings: [wireFinding('firm-x', quote)] },
      { cookie: s.cookie },
    );
    expect(f.status).toBe(200);
    expect(StoreFindingsResponseSchema.parse(f.body).stored).toBe(1);

    const d = await decide(h, s, {
      runId: run,
      quote,
      extra: { law_firm_id: 'firm-y', sneaky: 'x' },
    });
    expect(d.status).toBe(200);
    const dec = CreateDecisionResponseSchema.parse(d.body).decision;
    expect(dec).toMatchObject({
      status: 'active',
      decision: 'dismissed',
      decided_by_name: 'Eve (simulated analyst)',
    });
    // unknown keys are stripped: the firm came from the run (firm-x), never the body (firm-y)
    const row = await env.DB.prepare(
      'SELECT law_firm_id FROM decision WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, dec.id)
      .first<{ law_firm_id: string }>();
    expect(row?.law_firm_id).toBe('firm-x');
    expect(await dumpWorkspace(env.DB, s.workspaceId)).not.toContain('sneaky');

    const l = await lookup(h, s, 'firm-x', [fpOf('firm-x', 'defined_term_issue', quote)]);
    expect(MemoryLookupResponseSchema.parse(l.body).decisions.map((x) => x.id)).toContain(dec.id);

    const rv = await call(
      h,
      'POST',
      `/api/decisions/${dec.id}/revoke`,
      { client_op_id: op(), reason: 'undo' },
      { cookie: s.cookie },
    );
    expect(rv.status).toBe(200);
    expect(RevokeDecisionResponseSchema.parse(rv.body)).toEqual({ ok: true, current: null });
  });

  test('run_id is required for a decision (A0)', async () => {
    const h = makeMem();
    const s = await session(h);
    const body = decisionBody({ runId: 'x', quote: 'Q.' });
    delete body['run_id'];
    const r = await call(h, 'POST', '/api/decisions', body, { cookie: s.cookie });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'invalid_request', reason: 'run_required' });
  });

  test('counsel question and answer parse; the answer becomes the active decision', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = 'The Investor may elect Option A or Option B.';
    const fp = fpOf('firm-x', 'ambiguity', quote);
    await decide(h, s, {
      runId: run,
      quote,
      decision: 'accepted',
      cls: 'ambiguity',
      findingRef: 'fq1',
    });
    const q = await call(
      h,
      'POST',
      '/api/counsel/questions',
      {
        client_op_id: op(),
        finding_ref: 'fq1',
        fingerprint: fp,
        interpretations: ['A only', 'B only'],
      },
      { cookie: s.cookie },
    );
    expect(q.status).toBe(200);
    const qid = CounselQuestionResponseSchema.parse(q.body).question_id;
    const again = await call(
      h,
      'POST',
      '/api/counsel/questions',
      { client_op_id: op(), finding_ref: 'fq1', fingerprint: fp, interpretations: ['A only'] },
      { cookie: s.cookie },
    );
    expect(again.body.question_id).toBe(qid);
    const a = await call(
      h,
      'POST',
      '/api/counsel/answers',
      {
        client_op_id: op(),
        question_id: qid,
        option: 'A',
        note: 'Counsel chose A.',
        quote_text: quote,
        fingerprint: fp,
      },
      { cookie: s.cookie },
    );
    expect(a.status).toBe(200);
    const ans = CounselAnswerResponseSchema.parse(a.body);
    expect(ans.decision).toMatchObject({
      decision: 'answered',
      counsel_option: 'A',
      counsel_note: 'Counsel chose A.',
    });
    const l = await lookup(h, s, 'firm-x', [fp]);
    expect(l.body.decisions).toHaveLength(1);
    expect(l.body.decisions[0].id).toBe(ans.decision.id);
  });

  test('rules: list mapping (seed / proposal / manual), create, approve, reject', async () => {
    const h = makeMem();
    const s = await session(h);
    const list = await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, {
      cookie: s.cookie,
    });
    const rules = RulesResponseSchema.parse(list.body).rules;
    expect(rules.every((r) => r.origin === 'seed')).toBe(true);
    expect(rules.map((r) => r.status).sort()).toEqual(['active', 'proposed']);
    const c = await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-x',
      { client_op_id: op(), text: 'Manual rule text.' },
      { cookie: s.cookie },
    );
    expect(RuleActionResponseSchema.parse(c.body).rule).toMatchObject({
      origin: 'manual',
      status: 'active',
      evidence_count: 0,
    });
    const proposed = rules.find((r) => r.status === 'proposed')!;
    const ap = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(proposed.id)}/approve`,
      { client_op_id: op(), text: 'Edited while proposed.' },
      { cookie: s.cookie },
    );
    expect(ap.status).toBe(200);
    expect(RuleActionResponseSchema.parse(ap.body).rule).toMatchObject({
      status: 'active',
      text: 'Edited while proposed.',
      origin: 'seed',
    });
    const rj = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(proposed.id)}/reject`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(rj.status).toBe(400);
    expect(rj.body.error.reason).toBe('rule_state');
    const rv = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(c.body.rule.id)}/revoke`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(rv.status).toBe(200);
    const after = RulesResponseSchema.parse(
      (await call(h, 'GET', '/api/rules?law_firm_id=firm-x', undefined, { cookie: s.cookie })).body,
    ).rules;
    expect(after.map((r) => r.id)).not.toContain(c.body.rule.id); // DB revoked excluded from lists
  });

  test('should serve path-parameter routes and the frozen firm memory path', async () => {
    const h = makeMem();
    const s = await session(h);
    const canonical = await call(h, 'GET', '/api/memory/firm?law_firm_id=firm-x', undefined, {
      cookie: s.cookie,
    });
    const alias = await call(h, 'GET', '/api/memory/firms/firm-x', undefined, { cookie: s.cookie });
    expect(canonical.status).toBe(200);
    const body = FirmMemoryResponseSchema.parse(canonical.body);
    expect(alias.body).toEqual(canonical.body);
    expect(body.counts).toMatchObject({
      decisions: 6,
      dismissed: 4,
      answered: 1,
      awaiting: 1,
      rules_active: 1,
      rules_proposed: 1,
    });
    const bad = await call(h, 'GET', '/api/memory/firms/nope', undefined, { cookie: s.cookie });
    expect(bad.status).toBe(400);
    const run = await newRun(h, s);
    const ex = await call(
      h,
      'POST',
      `/api/runs/${run}/export`,
      { client_op_id: op(), question_count: 2 },
      { cookie: s.cookie },
    );
    expect(RunExportResponseSchema.parse(ex.body)).toMatchObject({
      run_id: run,
      sheet_question_count: 2,
    });
    const exp = await call(h, 'GET', '/api/export', undefined, { cookie: s.cookie });
    expect(ExportResponseSchema.parse(exp.body).export_version).toBe(1);
    const au = await call(h, 'GET', '/api/audit?limit=5', undefined, { cookie: s.cookie });
    const page = AuditResponseSchema.parse(au.body);
    expect(page.events).toHaveLength(5);
    expect(page.next_cursor).toBeDefined();
    const au2 = await call(h, 'GET', `/api/audit?limit=100&cursor=${page.next_cursor}`, undefined, {
      cookie: s.cookie,
    });
    const ids = new Set(
      [...page.events, ...AuditResponseSchema.parse(au2.body).events].map((e) => e.id),
    );
    expect(ids.size).toBe(page.events.length + au2.body.events.length); // keyset: no overlap
    const health = await call(h, 'GET', '/api/memory/health');
    expect(health.body).toMatchObject({ ok: true, schema_version: '6', seed_mode: '0' });
    expect((await call(h, 'GET', '/api/health')).body).toEqual({ ok: true });
  });
});
