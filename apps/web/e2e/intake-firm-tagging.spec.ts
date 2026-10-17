import { expect, test } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { confirmAllRows, hartwellFiles, runPackage } from './fixtures/package';

// Intake Phase 2 H3 (AC-I2): the package is tied to firm, fund and version; version required for N >= 2.
async function fill(
  page: import('@playwright/test').Page,
  firm: string,
  fund = 'Hartwell Fund III',
) {
  await page
    .getByTestId('upload-input')
    .setInputFiles(
      hartwellFiles().map((f) => ({ name: f.name, mimeType: 'text/html', buffer: f.buffer })),
    );
  await page.getByTestId('firm-combobox').fill(firm);
  await page.getByTestId('fund-input').fill(fund);
  await page.getByTestId('privacy-ack').check();
}

test.describe('intake-firm-tagging', () => {
  test('should resolve aliases, refuse free text, require fund and tag the package', async ({
    page,
  }) => {
    await gotoApp(page);
    await openDialog(page);
    await fill(page, 'Acme Legal Partners');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('upload-error')).toContainText('Free text is not accepted');
    await expect(page.getByTestId('package-confirm-table')).toHaveCount(0);

    await fill(page, 'Partners Group AG', '');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('upload-error')).toContainText('Enter the fund name.');

    await fill(page, 'Partners Group AG');
    await expect(page.getByTestId('firm-hint')).toHaveText('Resolves to Partners Group');
    await page.getByTestId('open-submit').click();
    await confirmAllRows(page);
    // version label is required for a package: empty holds the run
    await expect(page.getByTestId('package-version-input')).toHaveValue('');
    await expect(page.getByTestId('package-notice')).toContainText('Enter the version label');
    await expect(page.getByTestId('package-run')).toBeDisabled();
    await page.getByTestId('package-version-input').fill('2026 draft');
    await runPackage(page);
    await expect(page.getByTestId('doc-switcher')).toContainText('Partners Group');
    await expect(page.getByTestId('memory-not-applied')).toHaveCount(0);
    await expect(page.getByTestId('doc-pane')).toContainText('Hartwell Fund III · 2026 draft');
  });

  test('"Other / no firm" package opens with memory not applied', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    await fill(page, 'Other / no firm');
    await page.getByTestId('version-input').fill('v1');
    await expect(page.getByTestId('firm-hint')).toContainText('memory not applied');
    await page.getByTestId('open-submit').click();
    await confirmAllRows(page);
    await runPackage(page);
    await expect(page.getByTestId('memory-not-applied')).toBeVisible();
    await expect(page.getByTestId('doc-switcher')).toContainText('No firm');
  });
});
