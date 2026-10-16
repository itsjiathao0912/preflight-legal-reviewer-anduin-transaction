// AC40 (interim): per-invocation D1 query counts through the metering wrapper (local D1). Worst
// memory endpoint <= 20; a session that also claims the hourly lazy-purge slot <= 30 (documented
// exception, still well under the 50-per-invocation limit); the AI worst path on the D1 platform
// (cache, claims, breaker read, cache write, ledger) plus its outbound fetches stays well under 50.
// DV1: no per-IP request counter is re-added; the in-isolate pre-limit makes no query.
import { describe, expect, test } from 'vitest';
import { measureAi, measureEndpoints } from './budget-probe';

const CAPS: Record<string, number> = {
  session: 20,
  runs: 9, // +1 each write: N8 0-row budget pre-check (fix cycle 3)
  findings_25: 9,
  lookup_200: 2,
  decision_dismiss_with_proposal: 12,
  decision_supersede: 13,
  revoke: 8,
  counsel_question: 10,
  counsel_answer: 13,
  rules_list: 3,
  rule_approve: 7,
  firm: 5,
  audit: 3,
  run_export: 8, // +1 global budget claim (N1), +1 budget pre-check (N8)
  export: 5,
  session_with_purge: 30,
};

describe('query-budget (AC40 interim)', () => {
  test('every memory endpoint stays within its query budget', async () => {
    const m = await measureEndpoints();
    expect(Object.keys(m).sort()).toEqual(Object.keys(CAPS).sort());
    for (const [name, cap] of Object.entries(CAPS))
      expect(m[name]!.queries, name).toBeLessThanOrEqual(cap);
    const worst = Math.max(
      ...Object.entries(m)
        .filter(([k]) => k !== 'session_with_purge')
        .map(([, v]) => v.queries),
    );
    expect(worst).toBeLessThanOrEqual(20);
    expect(m['lookup_200']!.queries).toBe(2); // ctx liveness + ONE lookup query for 200 fingerprints
  });

  test('the AI worst path (incl. breaker read) uses well under the shared 50 budget', async () => {
    const ai = await measureAi();
    expect(ai.queries).toBeLessThanOrEqual(15);
    expect(ai.queries + ai.fetches).toBeLessThanOrEqual(20);
  });
});
