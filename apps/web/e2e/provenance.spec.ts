import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256Hex } from '@aduin/core';
import { expect, test } from '@playwright/test';
import {
  aiRows,
  enableLane,
  expectStage,
  hb,
  interceptAi,
  interceptQuota,
  MODEL,
  ndjson,
  recording,
  resultFrame,
} from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';

// AC36: every AI finding shows "AI suggestion" with the model and fresh vs from cache; rule findings
// show the rule id. The fresh path replays the live sample-03 recording through /api/ai.
const RAW = resolve(import.meta.dirname, '..', '..', '..', 'samples', 'sub-docs', 'raw');
const file03 = readdirSync(RAW).find((f) => f.startsWith('03-'))!;
const hash03 = sha256Hex(new Uint8Array(readFileSync(resolve(RAW, file03))));

test.describe('provenance', () => {
  test('cached AI findings say "from cache"; rule findings show the rule id', async ({ page }) => {
    await gotoApp(page);
    await interceptQuota(page);
    await enableLane(page);
    await openSample(page, '01');
    await expect(aiRows(page)).toHaveCount(2);
    await aiRows(page).first().click();
    const prov = page.getByTestId('finding-provenance');
    await expect(prov).toHaveAttribute('data-provenance', 'cache');
    await expect(prov).toContainText('AI suggestion');
    await expect(prov).toContainText(`${MODEL} · from cache`);
    await expect(page.getByTestId('finding-body')).toContainText('AI suggestion');
    const rule = page.getByTestId('finding-row').filter({ hasNotText: 'AI suggestion' }).first();
    await rule.click();
    await expect(page.getByTestId('finding-provenance')).toHaveAttribute('data-provenance', 'rule');
    await expect(page.getByTestId('finding-provenance')).toContainText(
      /^Rule \S+ · deterministic$/,
    );
  });

  test('a fresh /api/ai answer (replayed recording) says "fresh"; a Worker cache hit says "from cache"', async ({
    page,
  }) => {
    const rec = recording('sample-03');
    await gotoApp(page);
    await interceptQuota(page);
    await page.route('**/precomputed/**', (r) => r.fulfill({ status: 404, body: '' }));
    let cache: 'hit' | 'miss' = 'miss';
    const calls = await interceptAi(page, () => ({
      kind: 'stream',
      body: ndjson(hb, hb, resultFrame(rec.response.parsed.findings, cache, rec.meta.served_model)),
    }));
    await enableLane(page);
    await openSample(page, '03');
    await expectStage(page, /^Checks done · AI review not run/);
    await page.getByTestId('ai-run-sample').click();
    await expectStage(page, /^Checks done · AI review done/);
    // live #3 recording: 4 model findings, 2 verified, 2 rejected (quote not found)
    await expect(aiRows(page)).toHaveCount(2);
    await aiRows(page).first().click();
    await expect(page.getByTestId('finding-provenance')).toHaveAttribute(
      'data-provenance',
      'fresh',
    );
    await expect(page.getByTestId('finding-provenance')).toContainText(`${MODEL} · fresh`);

    // request contract: client header, document header, task, the engine's candidates
    expect(calls).toHaveLength(1);
    const c = calls[0]!;
    expect(c.headers['x-aduin-client']).toBe('1');
    expect(c.headers['x-aduin-doc']).toBe(hash03);
    expect(c.body.v).toBe(1);
    expect(c.body.task).toBe('clause-judgment');
    // demo / read-only path: no active rules injected, so no firm is sent (rules hash 'none')
    expect(c.body.law_firm_id).toBeNull();
    expect(c.body.candidates).toEqual(rec.request.candidates);

    cache = 'hit';
    await openSample(page, '03');
    await page.getByTestId('ai-run-sample').click();
    await expectStage(page, /^Checks done · AI review from cache/);
    await aiRows(page).first().click();
    await expect(page.getByTestId('finding-provenance')).toHaveAttribute(
      'data-provenance',
      'cache',
    );
  });
});
