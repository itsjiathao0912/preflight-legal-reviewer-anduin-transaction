import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openSample } from './fixtures/app';

async function fill(page: Page, firm: string) {
  await page.getByTestId('upload-input').setInputFiles({
    name: 'tagged.htm',
    mimeType: 'text/html',
    buffer: Buffer.from('<p>Section 1. Tagged.</p>'),
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
    await fill(page, 'Other / no firm');
    await expect(page.getByTestId('firm-hint')).toContainText('memory not applied');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('memory-not-applied')).toBeVisible();
    await expect(page.getByTestId('doc-switcher')).toContainText('No firm');
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
