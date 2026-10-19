import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFiles,
  openDemoPackage,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 3 join J0 (AC-I8 reload half, ruling R2): a plain reload reopens the remembered
// fund package (not only its primary document), without using Recent packages.
test.describe('intake-reload-restores-package', () => {
  test('should restore the Hartwell package view on reload', async ({ page }) => {
    test.setTimeout(150_000);
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await confirmAllRows(page);
    await runPackage(page);
    const line = page.getByTestId('findings-coverage-line');
    await expect(line).toBeVisible();
    const text = (await line.textContent()) ?? '';

    await page.reload();
    await waitForChecks(page);
    await expect(page.getByTestId('findings-coverage-line')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('findings-coverage-line')).toHaveText(text);
    await expect(page.getByTestId('open-document-dialog')).toHaveCount(0);
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-terms').click();
    await expect(page.getByTestId('package-lens')).toBeVisible();
    await expect(page.getByTestId('package-lens-doc')).toHaveCount(3);
  });

  test('should restore a file-kind demo package (northgate-iii) on reload', async ({ page }) => {
    test.setTimeout(150_000);
    await gotoApp(page);
    await openDemoPackage(page, 'northgate-iii');
    const rows = page.getByTestId('package-row');
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    let primary = false; // keep one to-digitize row, the rest baseline (as intake-demo-packages)
    for (let i = 0; i < (await rows.count()); i++) {
      const role = rows.nth(i).getByTestId('package-row-role');
      if ((await role.inputValue()) !== 'to_digitize') continue;
      if (primary) await role.selectOption('baseline');
      primary = true;
    }
    await confirmAllRows(page);
    const version = page.getByTestId('package-version-input');
    if (!(await version.inputValue())) await version.fill('v1');
    await runPackage(page);
    await expect(page.getByTestId('findings-coverage-line')).toBeVisible();

    await page.reload();
    await waitForChecks(page);
    await expect(page.getByTestId('findings-coverage-line')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('open-document-dialog')).toHaveCount(0);
  });
});
