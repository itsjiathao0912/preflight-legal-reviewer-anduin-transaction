// AC58 + R1: the server keeps only masked snippets, hashes and metadata. detail.facts/explanation
// canaries never persist; 9-digit numbers typed into free text are masked; snippets <= 300 chars
// and masked BEFORE truncation; the full quote is never stored. Canaries are synthetic.
import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import {
  call,
  decide,
  dumpWorkspace,
  fpOf,
  makeMem,
  newRun,
  op,
  session,
  wireFinding,
} from './memory-harness';

const CANARY_FACT = 'CANARY-FACT-zq81';
const CANARY_EXPL = 'CANARY-EXPLANATION-zq82';
const NUM = '000987654'; // synthetic, non-routable 9-digit run
const DIGIT_RUN = /\d(?:[ -]?\d){5,}/;

function freeTextValues(dump: string): string[] {
  const out: string[] = [];
  const tables = JSON.parse(dump) as Record<string, Record<string, unknown>[]>;
  const SKIP = new Set([
    'fingerprint',
    'quote_hash',
    'content_hash',
    'settings_hash',
    'firm_rules_hash',
    'anchor',
    'result_json',
    'id',
    'workspace_id',
    'review_run_id',
    'decision_id',
    'rule_id',
    'question_id',
    'counsel_answer_id',
    'current_decision_id',
    'matched_decision_id',
    'supersedes_id',
    'superseded_by_id',
    'origin_fund_id',
    'origin_document_id',
    'origin_review_run_id',
    'fund_id',
    'document_id',
    'entity_id',
    'analyst_id',
    'decided_by_analyst_id',
    'client_op_id',
    'seed_of',
    'proposal_key',
    'finding_key',
    'origin_finding_key',
    'detail_json',
  ]);
  for (const rows of Object.values(tables))
    for (const r of rows)
      for (const [k, v] of Object.entries(r))
        if (typeof v === 'string' && !SKIP.has(k)) out.push(`${k}=${v}`);
  return out;
}

describe('memory-storage-contract (AC58, R1)', () => {
  test('should never persist detail facts or explanation text', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const f = wireFinding('firm-x', 'A sentence with an undefined Term.', {
      facts: { term: CANARY_FACT, n: 3 },
      explanation: `Because ${CANARY_EXPL}.`,
    });
    expect(
      (
        await call(
          h,
          'POST',
          `/api/runs/${run}/findings`,
          { client_op_id: op(), findings: [f] },
          { cookie: s.cookie },
        )
      ).body.stored,
    ).toBe(1);
    const dump = await dumpWorkspace(env.DB, s.workspaceId);
    expect(dump).not.toContain(CANARY_FACT);
    expect(dump).not.toContain(CANARY_EXPL);
    const row = await env.DB.prepare('SELECT detail_json FROM finding WHERE workspace_id = ?1')
      .bind(s.workspaceId)
      .first<{ detail_json: string | null }>();
    expect(row?.detail_json).toBeNull();
  });

  test('should mask an account number typed into a note or fund name', async () => {
    const h = makeMem();
    const s = await session(h, `Analyst ${NUM}`);
    const docName = `Booklet ${NUM}.html`;
    const r = await call(
      h,
      'POST',
      '/api/runs',
      {
        client_op_id: op(),
        doc_name: docName,
        doc_hash: fpOf('firm-x', 'ambiguity', 'd'),
        law_firm_id: 'firm-x',
        fund_name: `Fund ${NUM}`,
        version_label: `v ${NUM}`,
        settings_hash: fpOf('firm-x', 'ambiguity', 's'),
      },
      { cookie: s.cookie },
    );
    const run = r.body.run_id;
    const quote = `Pay to account ${NUM} as instructed.`;
    const d = await decide(h, s, {
      runId: run,
      quote,
      note: `See ${NUM} in the note.`,
      fundName: `Fund ${NUM}`,
      patternKey: 'pay:account',
    });
    expect(d.status).toBe(200);
    expect(JSON.stringify(d.body)).not.toContain(NUM);
    await call(
      h,
      'POST',
      `/api/decisions/${d.body.decision.id}/revoke`,
      { client_op_id: op(), reason: `Reopened for ${NUM}` },
      { cookie: s.cookie },
    );
    await call(
      h,
      'POST',
      '/api/rules?law_firm_id=firm-x',
      { client_op_id: op(), text: `Account ${NUM} is a placeholder.` },
      { cookie: s.cookie },
    );
    const q = 'The Investor may choose A or B.';
    await decide(h, s, {
      runId: run,
      quote: q,
      decision: 'accepted',
      cls: 'ambiguity',
      findingRef: 'fq',
    });
    const qq = await call(
      h,
      'POST',
      '/api/counsel/questions',
      {
        client_op_id: op(),
        finding_ref: 'fq',
        fingerprint: fpOf('firm-x', 'ambiguity', q),
        interpretations: [`A means ${NUM}`],
      },
      { cookie: s.cookie },
    );
    await call(
      h,
      'POST',
      '/api/counsel/answers',
      {
        client_op_id: op(),
        question_id: qq.body.question_id,
        option: 'B',
        note: `Counsel ${NUM}`,
        quote_text: q,
        fingerprint: fpOf('firm-x', 'ambiguity', q),
      },
      { cookie: s.cookie },
    );
    const dump = await dumpWorkspace(env.DB, s.workspaceId);
    expect(dump).not.toContain(NUM);
    for (const v of freeTextValues(dump)) expect(v, v).not.toMatch(DIGIT_RUN);
    expect(dump).toContain('#7654'); // masked to # + last 4
  });

  test('snippets are masked BEFORE the 300-char truncation and the full quote is never stored', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s);
    const quote = `${'x'.repeat(293)} ${NUM} and then more words after the number to pass 300 characters.`;
    const d = await decide(h, s, { runId: run, quote });
    expect(d.status).toBe(200);
    const row = await env.DB.prepare(
      'SELECT quote_snippet FROM decision WHERE workspace_id = ?1 AND id = ?2',
    )
      .bind(s.workspaceId, d.body.decision.id)
      .first<{ quote_snippet: string }>();
    expect(row!.quote_snippet.length).toBeLessThanOrEqual(300);
    expect(row!.quote_snippet).not.toContain('00098'); // no head of the number survived truncation
    expect(row!.quote_snippet.replace('#7654', '')).not.toMatch(/\d/);
    expect(row!.quote_snippet).toContain('#7654');
    const dump = await dumpWorkspace(env.DB, s.workspaceId);
    expect(dump).not.toContain('pass 300 characters');
    const all = await env.DB.prepare('SELECT MAX(length(quote_snippet)) AS m FROM decision').first<{
      m: number;
    }>();
    expect(all!.m).toBeLessThanOrEqual(300);
  });
});
