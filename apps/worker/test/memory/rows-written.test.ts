// AC40 (interim) / M1: meta.rows_written per endpoint through the worker D1 binding (local D1;
// the wrangler CLI does not report rows_written). Remote calibration is spike S9 (SPIKE-RESULTS REF).
import { describe, expect, test } from 'vitest';
import { MEMORY_WRITE_WEIGHTS as W } from '../../src/platform/index';
import { env } from 'cloudflare:test';
import { EVIDENCE_LINK_MAX } from '../../src/memory/proposal';
import { measureAi, measureEndpoints } from './budget-probe';
import { call, decide, makeMem, newRun, op, session } from './memory-harness';
import { answer, askQuestion, withAssertion } from './variance-harness';
import { counselAnswerWeight } from '../../src/platform/index';

// Fix cycle 2 (N1): each write route's global-budget weight must cover its measured rows written,
// so the 30k-unit budget really bounds memory D1 rows/day. Sessions are bounded by SESSION_CAPS.
const WEIGHT_OF: Record<string, number> = {
  runs: W.run,
  findings_25: 25 + W.findingsBase,
  decision_dismiss_with_proposal: W.decision,
  decision_supersede: W.decision,
  revoke: W.other,
  counsel_question: W.other,
  counsel_answer: W.counselAnswer,
  rule_approve: W.other,
  run_export: W.other,
};

const CAPS: Record<string, number> = {
  session: 120,
  runs: 12,
  findings_25: 35,
  lookup_200: 0,
  decision_dismiss_with_proposal: 25,
  decision_supersede: 15,
  revoke: 10,
  counsel_question: 5,
  counsel_answer: 18,
  rules_list: 0,
  rule_approve: 10,
  firm: 0,
  audit: 0,
  run_export: 8,
  export: 0,
  session_with_purge: 130,
};

describe('rows-written (AC40 interim, M1)', () => {
  test('each endpoint writes no more rows than its cap; reads write nothing', async () => {
    const m = await measureEndpoints();
    for (const [name, cap] of Object.entries(CAPS))
      expect(m[name]!.rowsWritten, name).toBeLessThanOrEqual(cap);
  });

  test('a 25-finding chunk (server cap, S10/L5) writes about one row per finding (no secondary index)', async () => {
    const m = await measureEndpoints();
    expect(m['findings_25']!.rowsWritten).toBeGreaterThanOrEqual(25);
    // 25 finding rows + run recount + the M1 request and findings claims (1 row each)
    expect(m['findings_25']!.rowsWritten).toBeLessThanOrEqual(30);
  });

  test('global write-budget weights cover the measured rows of every write route (N1)', async () => {
    const m = await measureEndpoints();
    for (const [name, w] of Object.entries(WEIGHT_OF))
      expect(m[name]!.rowsWritten, name).toBeLessThanOrEqual(w);
  });

  test('the AI path writes only claims, cache and ledger rows', async () => {
    expect((await measureAi()).rowsWritten).toBeLessThanOrEqual(15);
  });

  test('N7: a reject -> dismiss re-proposal loop over 30 same-key dismissals stays within the decision weight', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const dismiss = (i: number) =>
      decide(h, s, {
        runId: run,
        quote: `Loop dismissal ${i}.`,
        patternKey: 'n7:loop',
        reason: 'no_form_impact',
      });
    for (let i = 0; i < 30; i++) expect((await dismiss(i)).status).toBe(200);
    const rule = await env.DB.prepare(
      "SELECT id FROM firm_rule WHERE workspace_id = ?1 AND proposal_key = 'n7:loop|no_form_impact' AND status = 'proposed'",
    )
      .bind(s.workspaceId)
      .first<{ id: string }>();
    const rj = await call(
      h,
      'POST',
      `/api/rules/${encodeURIComponent(rule!.id)}/reject`,
      { client_op_id: op() },
      { cookie: s.cookie },
    );
    expect(rj.status).toBe(200);
    h.resetStats();
    expect((await dismiss(30)).status).toBe(200);
    expect(h.stats.rowsWritten).toBeLessThanOrEqual(W.decision);
    const ev = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM rule_evidence e JOIN firm_rule r ON r.workspace_id = e.workspace_id AND r.id = e.rule_id WHERE r.workspace_id = ?1 AND r.proposal_key = 'n7:loop|no_form_impact' AND r.status = 'proposed'",
    )
      .bind(s.workspaceId)
      .first<{ n: number }>();
    expect(ev!.n).toBe(EVIDENCE_LINK_MAX);
  });

  test('run export: the drafted-question UPDATE is amortised (each question weight covers its own rows + 1 export row)', async () => {
    const m = await measureEndpoints();
    expect(m['counsel_question']!.rowsWritten + 1).toBeLessThanOrEqual(W.other);
  });

  // Variance Phase 03 (D3): own measurement (not via measureEndpoints, so the query-budget key set
  // stays unchanged). Index entries are counted by local D1 meta.rows_written.
  test('variance: answer-with-assertion rows stay within its measured weight; question owner adds 0 rows', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, 'hartwell-crane', 'Northgate Fund I');
    const plainQ = await askQuestion(h, s, { runId: run, firm: 'hartwell-crane' });
    h.resetStats();
    expect((await answer(h, s, plainQ)).status).toBe(200);
    const plainAnswer = h.stats.rowsWritten;
    const q = await askQuestion(h, s, { runId: run, firm: 'hartwell-crane' });
    h.resetStats();
    expect((await answer(h, s, q, withAssertion())).status).toBe(200);
    const withCheck = h.stats.rowsWritten;
    console.log(
      `variance rows_written: plain answer ${plainAnswer}, answer+assertion ${withCheck}`,
    );
    expect(plainAnswer).toBeLessThanOrEqual(W.counselAnswer);
    expect(withCheck).toBeLessThanOrEqual(W.counselAnswerWithAssertion);
    expect(withCheck).toBeGreaterThan(plainAnswer);
    // the weight function picks the larger weight only for a non-null assertion object
    expect(counselAnswerWeight({ assertion: { kind: 'scope_exists', label: 'x' } })).toBe(
      W.counselAnswerWithAssertion,
    );
    expect(counselAnswerWeight({ assertion: null })).toBe(W.counselAnswer);
    expect(counselAnswerWeight({ assertion: 'x' })).toBe(W.counselAnswer);
    expect(counselAnswerWeight({})).toBe(W.counselAnswer);
    // question creation: owner/owner_source add 0 rows
    const r2 = await newRun(h, s, 'hartwell-crane', 'Northgate Fund I');
    await askQuestion(h, s, { runId: r2, firm: 'hartwell-crane' });
    h.resetStats();
    await askQuestion(h, s, { runId: r2, firm: 'hartwell-crane' });
    const plainAsk = h.stats.rowsWritten;
    h.resetStats();
    await askQuestion(h, s, {
      runId: r2,
      firm: 'hartwell-crane',
      extra: { owner: 'gp', owner_source: 'override' },
    });
    expect(h.stats.rowsWritten).toBe(plainAsk);
  });
});
