import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';

test.describe('mobile shell (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('no sideways page scroll; Open a document CTA visible and opens the dialog', async ({
    page,
  }) => {
    await gotoApp(page);
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(w[0]).toBeLessThanOrEqual(w[1]!);
    const cta = page.getByTestId('empty-state').getByRole('button', { name: 'Open a document' });
    await expect(cta).toBeInViewport();
    await cta.click();
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
  });

  test('AI switch and name edit are reachable in the rail', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.aimini')).toBeInViewport();
    await expect(page.getByTestId('analyst-name-edit')).toBeInViewport();
  });
});

test.describe('open-document dialog edge cases', () => {
  test('a 0-byte unsupported file shows a clear error as soon as it is picked', async ({
    page,
  }) => {
    await gotoApp(page);
    await page.getByTestId('doc-switcher').click();
    await page.getByTestId('open-another').click();
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('') });
    await expect(page.getByTestId('upload-error')).toBeVisible();
    await expect(page.getByTestId('upload-error')).toContainText('not supported');
  });

  test('a 0-byte supported file shows the empty-file error', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('doc-switcher').click();
    await page.getByTestId('open-another').click();
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('') });
    await expect(page.getByTestId('upload-error')).toContainText('This file is empty.');
  });

  test('outside click closes the dialog opened from the document switcher', async ({ page }) => {
    await gotoApp(page);
    for (let i = 0; i < 5; i++) {
      await page.getByTestId('doc-switcher').click();
      await page.getByTestId('open-another').click();
      await expect(page.getByTestId('open-document-dialog')).toBeVisible();
      await page.mouse.click(2, 2);
      await expect(page.getByTestId('open-document-dialog')).toHaveCount(0);
    }
  });
});
