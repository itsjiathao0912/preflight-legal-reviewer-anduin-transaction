import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blockOpenRouter, enableLane, errorFrame, forbidAi, interceptQuota } from './fixtures/ai';
import { gotoApp, openDialog, openSample } from './fixtures/app';

/**
 * AC24: when OCR cannot run (no API in this build, quota, budget) the page image stays, a
 * "text not extracted" notice shows, and the rest of the app keeps working.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CROP = readFileSync(join(ROOT, 'fixtures', 'pdf', 'src', 'appa1-pg1-crop.jpg'));

async function uploadJpeg(page: Page) {
  await page
    .getByTestId('upload-input')
    .setInputFiles({ name: 'scan.jpg', mimeType: 'image/jpeg', buffer: CROP });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

async function expectImageOnly(page: Page) {
  await expect(page.getByTestId('scan-viewer')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('scan-page-image')).toBeVisible();
  await expect(page.getByTestId('scan-page-chip').first()).toHaveAttribute(
    'data-state',
    'unavailable',
  );
  await expect(page.getByTestId('scan-no-text')).toContainText('Text not extracted');
  await expect(page.getByTestId('scan-notice')).toContainText('Text not extracted for 1 of 1 page');
  await expect(page.getByTestId('loading-state')).toHaveCount(0);
}

test.describe('ocr-unavailable', () => {
  test('should show text not extracted when OCR is unavailable', async ({ page }) => {
    test.setTimeout(90_000);
    const openrouter = await blockOpenRouter(page);
    const ocr: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/ocr')) ocr.push(r.url());
    });
    await gotoApp(page); // preview build: VITE_API_BASE is '' (no Worker)
    await openDialog(page);
    await uploadJpeg(page);
    await expectImageOnly(page);
    await expect(page.getByTestId('ocr-unavailable')).toContainText(
      'OCR unavailable in this build',
    );
    expect(ocr).toEqual([]);
    expect(openrouter).toEqual([]);

    // nothing else breaks: an HTML sample still opens and the structure route still renders
    await openSample(page, '01');
    await expect(page.getByTestId('scan-viewer')).toHaveCount(0);
    await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
    await expect(page.getByTestId('ocr-unavailable')).toHaveCount(0);
  });

  for (const c of [
    { code: 'quota_exhausted', reason: 'visitor_limit', banner: 'OCR page limit reached' },
    { code: 'budget_cap', reason: undefined, banner: 'OCR is not available right now' },
  ]) {
    test(`keeps the page image when OCR answers ${c.code}`, async ({ page }) => {
      test.setTimeout(90_000);
      await blockOpenRouter(page);
      await forbidAi(page);
      await interceptQuota(page);
      await page.route('**/api/ocr', (route) =>
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
          body: `${JSON.stringify(errorFrame(c.code, c.reason))}\n`,
        }),
      );
      await gotoApp(page);
      await enableLane(page);
      await openDialog(page);
      await uploadJpeg(page);
      await expectImageOnly(page);
      await expect(page.getByTestId('ocr-down')).toContainText(c.banner);
    });
  }

  // Review F2: page images follow the AI consent switch. AI off -> zero /api/ocr requests.
  test('AI off: a scanned upload shows its image and sends nothing to /api/ocr', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const openrouter = await blockOpenRouter(page);
    await forbidAi(page);
    await interceptQuota(page);
    const ocr: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/ocr')) ocr.push(r.url());
    });
    await page.route('**/api/ocr', (route) => route.abort());
    await gotoApp(page);
    await enableLane(page);
    await page.getByTestId('ai-off').click();
    await expect(page.getByTestId('ai-off-banner')).toBeVisible();
    await openDialog(page);
    await uploadJpeg(page);
    await expectImageOnly(page);
    await expect(page.getByTestId('ocr-ai-off')).toContainText(
      'Text reading is off while AI review is off',
    );
    await expect(page.getByTestId('scan-no-text')).toContainText(
      'Text reading is off while AI review is off',
    );
    expect(ocr).toEqual([]);
    expect(openrouter).toEqual([]);
  });
});
