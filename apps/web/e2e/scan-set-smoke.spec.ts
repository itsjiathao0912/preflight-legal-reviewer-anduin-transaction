import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { blockOpenRouter } from './fixtures/ai';
import { gotoApp, openDialog, sample } from './fixtures/app';

/**
 * AC2 / AC3 (closing): the 22-page scan set #9 opens in one click from the picker. Pages with a
 * shipped precomputed OCR result read from the static file (no network beyond the app origin);
 * pages without one show their image with "Text not extracted" (preview build has no API).
 */
const INDEX = resolve(import.meta.dirname, '..', 'public', 'precomputed', 'ocr', 'index.json');
const precomputed = (
  (JSON.parse(readFileSync(INDEX, 'utf8')) as Record<string, { page: number }[]>)['09'] ?? []
).map((e) => e.page);

test.describe('scan-set-smoke', () => {
  test('should open the 22-page scan set and show per-page progress', async ({ page }) => {
    test.setTimeout(120_000);
    const openrouter = await blockOpenRouter(page);
    const apiCalls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/')) apiCalls.push(r.url());
    });
    // slow the static OCR files down so per-page progress is observable
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/precomputed/ocr/*.json', async (route) => {
      if (!route.request().url().endsWith('/index.json')) await gate;
      await route.continue();
    });
    await gotoApp(page);
    await openDialog(page);
    await sample(page, '09').click();
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();

    const chips = page.getByTestId('scan-page-chip');
    await expect(chips).toHaveCount(22, { timeout: 30_000 });
    if (precomputed.length) {
      // AC3: pages are still being read while the static files are held back
      await expect(
        page.locator('[data-testid="scan-page-chip"][data-state="running"]'),
      ).not.toHaveCount(0);
      await expect(page.getByTestId('stage-status-button')).toBeVisible();
    }
    await expect(page.getByTestId('scan-page-image')).toBeVisible();
    release();
    await expect(page.getByTestId('loading-state')).toHaveCount(0, { timeout: 60_000 });

    // every page ends done (shipped OCR) or unavailable (image only); none stuck
    for (let n = 1; n <= 22; n++) {
      const want = precomputed.includes(n) ? 'done' : 'unavailable';
      await expect(
        page.locator(`[data-testid="scan-page-chip"][data-page="${n}"]`),
      ).toHaveAttribute('data-state', want);
    }
    await expect(page.getByTestId('scan-summary')).toContainText('22 of 22 read');
    if (precomputed.includes(1)) {
      await expect(page.getByTestId('scan-text')).toContainText('Account Type');
    }
    // page navigation shows another page image
    await page.getByTestId('scan-next').click();
    await expect(page.getByTestId('scan-page-label')).toContainText('Page 2 of 22');
    await expect(page.getByTestId('scan-page-image')).toHaveAttribute(
      'src',
      /09-rw-holdings-scans\/p02\.jpg$/,
    );
    expect(apiCalls).toEqual([]);
    expect(openrouter).toEqual([]);
  });
});
