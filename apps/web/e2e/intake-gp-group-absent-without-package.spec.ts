import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openSample } from './fixtures/app';
import { gotoCounsel } from './fixtures/counsel';
import { waitForChecks } from './fixtures/package';

// Intake Phase 3c D2 (R1): Samples-list opens and classic uploads show no GP group; a single
// high-confidence sub agreement upload is a one-document package and shows the group
// (none-state: the fixture references no outside document).
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
  test('should hide the GP group for a Samples-list open and a classic upload', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await openSample(page, '03');
    await gotoCounsel(page);
    await expect(page.getByTestId('counsel-list')).toBeVisible();
    await expect(page.getByTestId('gp-group')).toHaveCount(0);
    await uploadOne(page, 'tiny-note.html', TINY);
    await gotoCounsel(page);
    await expect(page.getByTestId('counsel-list')).toBeVisible();
    await expect(page.getByTestId('gp-group')).toHaveCount(0);
  });

  test('should show the GP group for a one-document package', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadOne(page, 'sections-parts.html', SUB);
    await gotoCounsel(page);
    const group = page.getByTestId('gp-group');
    await expect(group).toBeVisible({ timeout: 30_000 });
    // Requests come only from text references (core buildDocumentRequests); this fixture names
    // no outside document, so the group shows its none-state (plan 3c-D2 deviation, see report).
    await expect(group.getByTestId('gp-request-none')).toBeVisible();
    await expect(group.getByTestId('gp-request-item')).toHaveCount(0);
  });
});
