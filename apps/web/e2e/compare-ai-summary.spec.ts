import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { enableLane, hb, interceptAi, interceptQuota, MODEL, ndjson } from './fixtures/ai';
import { gotoApp } from './fixtures/app';
import { openCompare, pickPair, waitDiff } from './fixtures/compare';

// Phase 07c (AC15 H part): the Compare "AI summary" of the #5 -> #6 rename drift. Explicit button
// only (no call on open), labelled AI suggestion with provenance, honest states when AI is off,
// not connected, refused, or when the answer names no rename the diff found. /api/ai is
// route-intercepted with the committed drift-narrative recordings.
const V5 = 'PG NGI 2024';
const V6 = 'PG NGI 2026';
const REC = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'llm-recordings',
  'drift-narrative',
);

interface Drafts {
  case: string;
  response: { parsed: { drafts: { candidate_id: string; text: string }[] } };
}
function drafts(caseId: string) {
  for (const n of readdirSync(REC)) {
    const j = JSON.parse(readFileSync(resolve(REC, n), 'utf8')) as Drafts;
    if (j.case === caseId) return j.response.parsed.drafts;
  }
  throw new Error(`no recording ${caseId}`);
}
const frame = (d: unknown[], cache: 'hit' | 'miss' = 'miss') => ({
  t: 'result',
  kind: 'ai',
  data: { v: 1, findings: [], drafts: d },
  cache,
  model: MODEL,
});

async function openPair(page: Page) {
  await openCompare(page);
  await pickPair(page, V5, V6);
  await waitDiff(page);
}

const ai = (page: Page) => page.getByTestId('cmp-ai');

test.describe('compare-ai-summary', () => {
  test('no API in this build: honest "not available", zero /api/ai calls', async ({ page }) => {
    await gotoApp(page);
    const calls = await interceptAi(page, () => ({ kind: 'stream', body: ndjson(hb) }));
    await openPair(page);
    await expect(ai(page)).toHaveAttribute('data-state', 'unavailable');
    await expect(ai(page)).toContainText('AI summary is not available');
    await expect(page.getByTestId('cmp-item').first()).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  test('AI switched off: says so and never calls', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ui:v1:ai', 'off'));
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, () => ({ kind: 'stream', body: ndjson(hb) }));
    await enableLane(page);
    await openPair(page);
    await expect(ai(page)).toHaveAttribute('data-state', 'off');
    expect(calls).toHaveLength(0);
  });

  test('explicit Summarize: replays the recording, labelled AI suggestion, masked request', async ({
    page,
  }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, () => ({
      kind: 'stream',
      body: ndjson(hb, frame(drafts('drift-narrative-05-06'))),
    }));
    await enableLane(page);
    await openPair(page);
    await expect(ai(page)).toHaveAttribute('data-state', 'idle');
    expect(calls).toHaveLength(0); // no call on open
    await page.getByTestId('cmp-ai-run').click();
    await expect(ai(page)).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('cmp-ai-line')).toHaveCount(5);
    await expect(page.getByTestId('cmp-ai-line').first()).toContainText('Units → Shares');
    const prov = page.getByTestId('cmp-ai-provenance');
    await expect(prov.getByTestId('ai-suggestion-label')).toHaveText('AI suggestion');
    await expect(prov).toContainText(`${MODEL} · fresh`);

    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.body.task).toBe('drift-narrative');
    expect(c.body.law_firm_id).toBeNull();
    expect(c.headers['x-aduin-client']).toBe('1');
    expect(c.headers['x-aduin-doc']).toBeUndefined();
    expect(c.body.candidates.map((x) => x.id)).toEqual([
      'rn_01',
      'rn_02',
      'rn_03',
      'rn_04',
      'rn_05',
    ]);
    for (const x of c.body.candidates) {
      expect(x.quote).toMatch(/^Rename: "/);
      expect(x.quote).not.toMatch(/\d{5,}/);
    }
  });

  test('refused or unusable answers: "AI summary skipped" with Retry; diff unaffected', async ({
    page,
  }) => {
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, (_c, n) =>
      n === 1
        ? { kind: 'http', status: 429, code: 'rate_limited', retry_after_s: 30 }
        : {
            kind: 'stream',
            // only invented renames / unknown ids: nothing survives the rename filter
            body: ndjson(
              frame([
                { candidate_id: 'rn_01', text: 'The Units are now Interests.' },
                { candidate_id: 'rn_99', text: 'The Custodian is now the Trustee.' },
              ]),
            ),
          },
    );
    await enableLane(page);
    await openPair(page);
    await page.getByTestId('cmp-ai-run').click();
    await expect(ai(page)).toHaveAttribute('data-state', 'skipped');
    await expect(ai(page)).toContainText('AI summary skipped');
    await expect(ai(page).locator('[data-reason]')).toHaveAttribute('data-reason', 'rate');
    await page.getByTestId('cmp-ai-retry').click();
    await expect(ai(page).locator('[data-reason]')).toHaveAttribute(
      'data-reason',
      'result_unusable',
    );
    await expect(page.getByTestId('cmp-ai-line')).toHaveCount(0);
    await expect(page.getByTestId('cmp-item').first()).toBeVisible();
    expect(calls).toHaveLength(2);
  });
});
