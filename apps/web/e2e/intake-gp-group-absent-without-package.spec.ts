import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { gotoCounsel } from './fixtures/counsel';
import { waitForChecks } from './fixtures/package';

// Intake Phase 3c D2 (R1), as reworked into Requests: a classic upload has nothing for the GP; a
// single high-confidence sub agreement upload is a one-document package whose GP request is also
// empty (the fixture references no outside document), so its row stays in the "none" state and
// opens no drawer. Bundled samples are no longer opened one by one (0c3a6a2).
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const SUB = readFileSync(join(ROOT, 'packages', 'core', 'test', 'fixtures', 'sections-parts.html'));
const TINY = Buffer.from('<html><body><p>Short note with no headings.</p></body></html>');

async function uploadOne(page: Page, name: string, buffer: Buffer) {
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType: 'text/html', buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
  await waitForChecks(page);
}

test.describe('intake-gp-group-absent-without-package', () => {
  test('should have no GP request for a classic upload', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadOne(page, 'tiny-note.html', TINY);
    await gotoCounsel(page, null);
    await expect(page.getByTestId('requests-list')).toBeVisible();
    await expect(page.getByTestId('requests-row-gp')).toHaveAttribute('data-status', 'none');
    await expect(page.getByTestId('requests-row-docs')).toHaveText(['', '', '']);
  });

  test('should show the package summary but no documents to send for a one-document package', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadOne(page, 'sections-parts.html', SUB);
    await page.getByTestId('nav-documents').click();
    await expect(page.getByTestId('package-summary')).toBeVisible({ timeout: 30_000 });
    // Requests come only from text references (core buildDocumentRequests); this fixture names
    // no outside document, so the GP request is empty (plan 3c-D2 deviation, see report).
    await gotoCounsel(page, null);
    await expect(page.getByTestId('requests-row-gp')).toHaveAttribute('data-status', 'none');
  });
});
