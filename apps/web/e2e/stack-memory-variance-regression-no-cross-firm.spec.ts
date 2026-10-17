import { fingerprint, quoteHash, type IssueClass } from '@aduin/core';
import { apiJson, expect, newStackContext, stackHome, test } from './fixtures/stack-memory';
import type { Page } from '@playwright/test';

// AC-V16 on the real Worker (local D1, migration 0006): a firm_template answer with an assertion
// creates a regression check that the lookup returns only to the same workspace AND firm; a forged
// scope without intent and an answer over the per-firm cap are refused.
const FIRM = 'hartwell-crane';
const CLS: IssueClass = 'ambiguity';
const FP = 'f'.repeat(64);

interface Checks {
  decisions: unknown[];
  regression_checks?: { assertion_key: string; statement_text: string }[];
}

let seq = 0;
const opId = (tag: string) => `${tag}-${Date.now().toString(36)}-${++seq}`;

/** Mint a sandbox session for this page's context (the app itself creates one lazily). */
async function session(page: Page): Promise<void> {
  await stackHome(page);
  const r = await apiJson<{ kind: string }>(page, 'POST', '/api/session', {
    analyst_name: 'Variance Analyst',
  });
  expect(r.status).toBe(200);
  expect(r.body.kind).toBe('sandbox');
}

async function newRun(page: Page, firm: string): Promise<string> {
  const r = await apiJson<{ run_id: string }>(page, 'POST', '/api/runs', {
    client_op_id: opId('run'),
    doc_name: 'Northgate Fund I.html',
    doc_hash: quoteHash(`variance-stack-${Math.random()}`),
    law_firm_id: firm,
    fund_name: 'Northgate Fund I',
    version_label: 'v1',
    settings_hash: quoteHash('settings'),
  });
  expect(r.status).toBe(200);
  return r.body.run_id;
}

/** decision (accepted) -> question -> answer body for one quote on the given run. */
async function question(page: Page, runId: string, firm: string, i: number) {
  const quote = `Variance stack quote ${i} ${Math.random()}.`;
  const fp = fingerprint(firm, CLS, quoteHash(quote));
  const ref = `vs-${i}-${seq}`;
  const d = await apiJson(page, 'POST', '/api/decisions', {
    client_op_id: opId('dec'),
    run_id: runId,
    finding_ref: ref,
    decision: 'accepted',
    quote_text: quote,
    fingerprint: fp,
    issue_class: CLS,
  });
  expect(d.status).toBe(200);
  const q = await apiJson<{ question_id: string }>(page, 'POST', '/api/counsel/questions', {
    client_op_id: opId('q'),
    finding_ref: ref,
    fingerprint: fp,
    interpretations: ['a', 'b'],
    owner: 'counsel',
    owner_source: 'suggested',
  });
  expect(q.status).toBe(200);
  return { quote, fp, questionId: q.body.question_id };
}

const answerWithCheck = (
  page: Page,
  q: { quote: string; fp: string; questionId: string },
  label: string,
  extra: Record<string, unknown> = {},
) =>
  apiJson<{ error?: { code: string; reason?: string } }>(page, 'POST', '/api/counsel/answers', {
    client_op_id: opId('ans'),
    question_id: q.questionId,
    option: 'A',
    quote_text: q.quote,
    fingerprint: q.fp,
    scope: 'firm_template',
    intent: 'This appendix is part of the firm standard template.',
    assertion: { kind: 'scope_exists', label },
    ...extra,
  });

const lookup = (page: Page, firm: string) =>
  apiJson<Checks>(page, 'POST', '/api/memory/lookup', { law_firm_id: firm, fingerprints: [FP] });

test.describe('stack-memory variance regression no cross-firm', () => {
  test('a check reaches only its own workspace and firm; forged scope and over-cap are refused', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await session(page);
    const run = await newRun(page, FIRM);
    const q0 = await question(page, run, FIRM, 0);
    const created = await answerWithCheck(page, q0, 'Appendix C');
    expect(created.status).toBe(200);

    const same = await lookup(page, FIRM);
    expect(same.status).toBe(200);
    expect(same.body.regression_checks).toEqual([
      expect.objectContaining({
        assertion_key: 'appendix c',
        statement_text: 'Appendix C must exist',
      }),
    ]);
    expect((await lookup(page, 'ostrander-pell')).body.regression_checks).toEqual([]);

    // another workspace (fresh sandbox), same firm: no check
    const other = await newStackContext(browser, baseURL!);
    const otherPage = await other.newPage();
    await session(otherPage);
    expect((await lookup(otherPage, FIRM)).body.regression_checks).toEqual([]);
    await other.close();

    // a forged firm_template scope without intent, and an assertion without firm_template
    const q1 = await question(page, run, FIRM, 1);
    const noIntent = await answerWithCheck(page, q1, 'Appendix D', { intent: undefined });
    expect(noIntent.status).toBe(400);
    expect(noIntent.body.error?.code).toBe('invalid_request');
    const fundScope = await answerWithCheck(page, q1, 'Appendix D', { scope: 'fund' });
    expect(fundScope.status).toBe(400);

    // fill the firm to the cap (20 active checks), then one more is refused
    for (let i = 2; i <= 20; i++) {
      const q = await question(page, run, FIRM, i);
      const r = await answerWithCheck(page, q, `Appendix ${String.fromCharCode(63 + i)}`);
      expect(r.status, `check ${i}`).toBe(200);
    }
    expect((await lookup(page, FIRM)).body.regression_checks).toHaveLength(20);
    const over = await answerWithCheck(page, await question(page, run, FIRM, 21), 'Appendix Z');
    expect(over.status).toBe(400);
    expect(over.body.error?.reason).toBe('regression_check_cap');
  });
});
