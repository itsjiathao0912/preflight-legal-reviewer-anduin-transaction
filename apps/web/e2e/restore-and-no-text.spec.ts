import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { forbidAi } from './fixtures/ai';
import { gotoApp, openDialog, rowsLoc } from './fixtures/app';

/**
 * Bug fixes (live demo): an upload with no readable text is never "Ready to digitize", and an
 * uploaded document comes back after a page reload (stored in this browser for 24 h).
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const SCANNED = readFileSync(
  join(
    ROOT,
    'samples',
    'packages',
    '03-redwood-ridge-credit-i',
    'docs',
    '06-RR1-Tax-Forms-Guide-SCANNED.docx',
  ),
);
const HTML = readFileSync(
  join(ROOT, 'samples', 'sub-docs', 'raw', '03-partners-group-pe-master-2019.htm'),
);

async function upload(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType, buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
}

test.describe('restore-and-no-text', () => {
  test('an image-only DOCX with AI off is never Ready to digitize', async ({ page }) => {
    await forbidAi(page);
    await gotoApp(page);
    await page.getByTestId('ai-off').click();
    await upload(page, '06-RR1-Tax-Forms-Guide-SCANNED.docx', SCANNED, 'application/octet-stream');
    await expect(page.getByTestId('stage-status-button')).toContainText('No text could be read', {
      timeout: 60_000,
    });
    const gate = page.getByTestId('gate-button');
    await expect(gate).toHaveAttribute('data-gate-state', 'unreadable');
    await expect(gate).not.toContainText('Ready');
    await expect(page.getByTestId('no-text-banner')).toContainText('No text could be read');
    await expect(page.getByTestId('doc-switcher')).toContainText('06-RR1-Tax-Forms-Guide-SCANNED');
  });

  test('an uploaded document and its findings come back after a reload', async ({ page }) => {
    await forbidAi(page);
    await gotoApp(page);
    await page.getByTestId('ai-off').click();
    await upload(page, 'form.html', HTML, 'text/html');
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')),
    );
    expect(ids.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('doc-switcher')).toContainText('form.html');
    await expect(rowsLoc(page).first()).toBeVisible();
    expect(
      await rowsLoc(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-finding-id'))),
    ).toEqual(ids);
  });
});
