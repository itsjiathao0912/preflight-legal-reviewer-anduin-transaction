import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openSample } from './fixtures/app';
import { waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3b (R1): Samples-list opens and classic uploads show no package UI; a single
// high-confidence sub agreement upload is a one-document package and does.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const SECTIONS = readFileSync(
  join(ROOT, 'packages', 'core', 'test', 'fixtures', 'sections-parts.html'),
);

async function upload(page: Page, name: string, buffer: Buffer) {
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType: 'text/html', buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await waitForChecks(page);
}

async function expectNoPackageUi(page: Page) {
  await expect(page.getByTestId('findings-coverage-line')).toHaveCount(0);
  await expect(page.getByTestId('gp-group')).toHaveCount(0);
  await page.getByTestId('nav-structure').click();
  await expect(page.getByTestId('structure-view')).toBeVisible();
  await expect(page.getByTestId('structure-lens-package')).toHaveCount(0);
  await page.getByTestId('nav-findings').click();
}

test.describe('intake-no-package-ui-on-samples', () => {
  for (const id of ['03', '11']) {
    test(`should show no package UI for sample #${id}`, async ({ page }) => {
      await gotoApp(page);
      await openSample(page, id);
      await expectNoPackageUi(page);
    });
  }

  test('should show no package UI for a tiny or hostile classic upload', async ({ page }) => {
    await gotoApp(page);
    await upload(
      page,
      'tiny.html',
      Buffer.from('<html><body><p>Hello <script>alert(1)</script></p></body></html>'),
    );
    await expectNoPackageUi(page);
  });

  test('should show the coverage line and Package tab for a one-document package', async ({
    page,
  }) => {
    await gotoApp(page);
    await upload(page, 'sections-parts.html', SECTIONS);
    await expect(page.getByTestId('findings-coverage-line')).toHaveText(/^Coverage: partial/);
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-lens-package')).toBeVisible();
  });
});
