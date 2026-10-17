// C6: the persisted finding.memory_label (Worker runs.ts) equals the label the client computes
// (web fingerprintFindings: core resolveLabel + scopeMismatch with the active fund name) for a
// scope = fund decision recorded in another fund; a mismatched decision is NOT linked.
import { env } from 'cloudflare:test';
import { resolveLabel, scopeMismatch, type ActiveDecision } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { call, lookup, makeMem, newRun, op, session, wireFinding } from './memory-harness';
import { answer, askQuestion } from './variance-harness';

const FIRM = 'firm-x';

async function storeAndRead(
  h: ReturnType<typeof makeMem>,
  s: Awaited<ReturnType<typeof session>>,
  fund: string,
  quote: string,
) {
  const run = await newRun(h, s, FIRM, fund);
  const f = wireFinding(FIRM, quote, { cls: 'ambiguity', severity: 'high' });
  const r = await call(
    h,
    'POST',
    `/api/runs/${run}/findings`,
    { client_op_id: op(), findings: [f] },
    { cookie: s.cookie },
  );
  expect(r.status).toBe(200);
  const row = await env.DB.prepare(
    'SELECT memory_label, matched_decision_id FROM finding WHERE workspace_id = ?1 AND review_run_id = ?2',
  )
    .bind(s.workspaceId, run)
    .first<{ memory_label: string; matched_decision_id: string | null }>();
  return { f, row: row! };
}

/** The client-side label for the same inputs (mirrors apps/web fingerprintFindings). */
function clientLabel(
  f: ReturnType<typeof wireFinding>,
  decisions: ActiveDecision[],
  fundName: string,
): string {
  const found = decisions.find((d) => d.fingerprint === f.fingerprint) ?? null;
  const scope = { fundName };
  const prior = found && !scopeMismatch(found, scope) ? found : null;
  return resolveLabel(f, prior, scope);
}

describe('variance-label-call-sites (C6)', () => {
  test('should persist the same label the client computes for a fund-scoped decision in another fund', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: FIRM, fund: 'Fund A' });
    const a = await answer(h, s, q, { scope: 'fund' });
    expect(a.status).toBe(200);
    expect(a.body.decision.scope).toBe('fund');
    const decisionId = a.body.decision.id as string;
    const decisions = (await lookup(h, s, FIRM, [q.fp])).body.decisions as ActiveDecision[];
    expect(decisions.map((d) => d.scope)).toEqual(['fund']);

    // fund B: the fund-scoped decision does not apply -> new, and NOT linked
    const other = await storeAndRead(h, s, 'Fund B', q.quote);
    expect(other.row.memory_label).toBe('new');
    expect(other.row.matched_decision_id).toBeNull();
    expect(clientLabel(other.f, decisions, 'Fund B')).toBe(other.row.memory_label);

    // fund A: it applies -> already_answered, linked
    const same = await storeAndRead(h, s, 'Fund A', q.quote);
    expect(same.row.memory_label).toBe('already_answered');
    expect(same.row.matched_decision_id).toBe(decisionId);
    expect(clientLabel(same.f, decisions, 'Fund A')).toBe(same.row.memory_label);
  });

  test('a firm_template decision applies in every fund (label and link)', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: FIRM, fund: 'Fund A' });
    const a = await answer(h, s, q, { scope: 'firm_template', intent: 'Firm standard.' });
    expect(a.status).toBe(200);
    const decisions = (await lookup(h, s, FIRM, [q.fp])).body.decisions as ActiveDecision[];
    const other = await storeAndRead(h, s, 'Fund B', q.quote);
    expect(other.row.memory_label).toBe('already_answered');
    expect(other.row.matched_decision_id).toBe(a.body.decision.id);
    expect(clientLabel(other.f, decisions, 'Fund B')).toBe('already_answered');
  });

  test('an answered-unclear decision keeps its link (no-link keyed on the scope mismatch only)', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: FIRM, fund: 'Fund A' });
    const a = await answer(h, s, q, { option: 'unclear' });
    expect(a.status).toBe(200);
    const other = await storeAndRead(h, s, 'Fund B', q.quote);
    expect(other.row.memory_label).toBe('new');
    expect(other.row.matched_decision_id).toBe(a.body.decision.id);
  });
});
