// AC40 (interim) / M1: meta.rows_written per endpoint through the worker D1 binding (local D1;
// the wrangler CLI does not report rows_written). Remote calibration is spike S9 (SPIKE-RESULTS REF).
import { describe, expect, test } from 'vitest';
import { MEMORY_WRITE_WEIGHTS as W } from '../../src/platform/index';
import { measureAi, measureEndpoints } from './budget-probe';

// Fix cycle 2 (N1): each write route's global-budget weight must cover its measured rows written,
// so the 40k-unit budget really bounds memory D1 rows/day. Sessions are bounded by SESSION_CAPS.
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
});
