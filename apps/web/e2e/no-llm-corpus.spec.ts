import { expect, test } from '@playwright/test';
import { blockOpenRouter } from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';
import { gotoCounsel, gotoFindings } from './fixtures/counsel';

/**
 * AC25 (Phase 08 S3.3): no-LLM mode. With AI switched off and no API base (preview build), every
 * bundled HTML sample processes end to end: structure + findings, the counsel sheet (template
 * wording) and the gate pill render, with zero uncaught page errors and zero AI / OpenRouter
 * calls. Finding accuracy is not asserted here (that is the core `test:corpus` gate).
 */
const HTML = ['01', '02', '03', '04', '05', '06', '07', '08', '10', '11', '12', '13'];

test.describe('no-llm-corpus', () => {
  test('every sample processes with AI off: no uncaught errors, no AI calls', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const openrouter = await blockOpenRouter(page);
    const aiCalls: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/(ai|ocr)\b/.test(r.url())) aiCalls.push(r.url());
    });
    await page.addInitScript(() => window.localStorage.setItem('ui:v1:ai', 'off'));
    await gotoApp(page);
    for (const id of HTML) {
      await openSample(page, id);
      await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
      await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
      await expect(page.getByTestId('gate-button')).toBeVisible();
      await gotoCounsel(page);
      await expect(page.getByTestId('counsel-view')).toBeVisible();
      await gotoFindings(page);
    }
    expect(errors).toEqual([]);
    expect(aiCalls).toEqual([]);
    expect(openrouter).toEqual([]);
  });
});
