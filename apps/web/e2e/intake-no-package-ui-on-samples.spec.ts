import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openFindingsView } from './fixtures/app';
import { coverageLine, waitForChecks } from './fixtures/package';

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
  // no coverage line in the gate popover, no package sources, no package summary on Documents
  await page.getByTestId('gate-button').click();
  await expect(page.getByTestId('gate-popover')).toBeVisible();
  await expect(page.getByTestId('gate-coverage-line')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await openFindingsView(page, 'sources');
  await expect(page.getByTestId('sources-confirm')).toHaveCount(0);
  await expect(page.getByTestId('sources-open-file')).toHaveCount(0);
  await page.getByTestId('nav-documents').click();
  await expect(page.getByTestId('documents-view')).toBeVisible();
  await expect(page.getByTestId('package-summary')).toHaveCount(0);
  await page.getByTestId('nav-findings').click();
}

test.describe('intake-no-package-ui-on-samples', () => {
  // Bundled samples can no longer be opened one by one (0c3a6a2), and an uploaded sub agreement is
  // a one-document package by design, so the former "sample #3 / #11" cases are covered by the
  // classic (non-sub-agreement) uploads below.
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
    await expect(await coverageLine(page)).toHaveText(/^Coverage: partial/);
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-documents').click();
    await expect(page.getByTestId('package-summary')).toBeVisible();
  });
});
