import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openSample, rowsLoc } from './fixtures/app';
import { acceptRow } from './fixtures/findings-actions';

const RICH = readFileSync(
  join(
    resolve(import.meta.dirname, '..', '..', '..'),
    'samples',
    'sub-docs',
    'raw',
    '03-partners-group-pe-master-2019.htm',
  ),
);

async function fill(page: Page, firm: string, html: string | Buffer = '<p>Section 1. Tagged.</p>') {
  await page.getByTestId('upload-input').setInputFiles({
    name: 'tagged.htm',
    mimeType: 'text/html',
    buffer: typeof html === 'string' ? Buffer.from(html) : html,
  });
  await page.getByTestId('firm-combobox').fill(firm);
  await page.getByTestId('fund-input').fill('Growth Fund II');
  await page.getByTestId('version-input').fill('2026 draft');
  await page.getByTestId('privacy-ack').check();
}

test.describe('upload-firm-tagging', () => {
  test('aliases resolve to the canonical firm; the tag shows in the shell', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    await fill(page, 'PG');
    await expect(page.getByTestId('firm-hint')).toHaveText('Resolves to Partners Group');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
    await expect(page.getByTestId('doc-switcher')).toContainText('Partners Group');
    await expect(page.getByTestId('memory-not-applied')).toHaveCount(0);
    await expect(page.getByTestId('doc-pane')).toContainText('Growth Fund II · 2026 draft');
  });

  test('free text is refused', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    await fill(page, 'Acme Legal Partners');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('upload-error')).toContainText('Free text is not accepted');
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
  });

  test('"Other / no firm" opens with memory not applied', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    await fill(page, 'Other / no firm', RICH);
    await expect(page.getByTestId('firm-hint')).toContainText('memory not applied');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('memory-not-applied')).toBeVisible();
    await expect(page.getByTestId('memory-not-applied')).toContainText(
      'open it again and pick a law firm',
    );
    await expect(page.getByTestId('doc-switcher')).toContainText('No firm');
    // Accept on a no-firm document is local only, and the toast says so
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    await expect(rowsLoc(page).first()).toBeVisible();
    await acceptRow(page, (await rowsLoc(page).first().getAttribute('data-finding-id'))!);
    await expect(page.getByTestId('undo-toast')).toContainText(
      'Pick a law firm to remember this decision.',
    );
  });

  test('samples #3-#6 are pre-tagged to one firm', async ({ page }) => {
    await gotoApp(page);
    for (const id of ['03', '04', '05', '06']) {
      await openSample(page, id);
      await expect(page.getByTestId('doc-switcher')).toContainText('Partners Group');
      await expect(page.getByTestId('memory-not-applied')).toHaveCount(0);
    }
  });
});
