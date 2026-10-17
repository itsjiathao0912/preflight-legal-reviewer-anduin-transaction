import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, hartwellFiles, runPackage, uploadPackage } from './fixtures/package';

// Intake Phase 2 H1 (AC-I1): many files in one action open the confirmation table; Run opens findings.
test.describe('intake-multi-upload', () => {
  test('should open the confirmation table for three files dropped at once', async ({ page }) => {
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    const table = page.getByTestId('package-confirm-table');
    await expect(table).toBeVisible();
    const rows = page.getByTestId('package-row');
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const r = rows.nth(i);
      await expect(r.getByTestId('package-row-type')).toBeVisible();
      await expect(r.getByTestId('package-row-role')).toBeVisible();
      await expect(r.getByTestId('package-row-confidence')).toHaveText(/High|Low/);
      await expect(r.getByTestId('package-row-reason')).not.toBeEmpty();
    }
    const sub = rows.filter({ hasText: 'fund-iii-subscription-agreement.html' });
    await expect(sub.getByTestId('package-row-type')).toHaveValue('sub_agreement');
    await expect(sub.getByTestId('package-row-role')).toHaveValue('to_digitize');
    const lpa = rows.filter({ hasText: 'northgate-lpa-definitions.docx' });
    await expect(lpa.getByTestId('package-row-type')).toHaveValue('lpa');
    await confirmAllRows(page);
    await runPackage(page);
    await expect(page.getByTestId('doc-pane')).toContainText('Hartwell Fund III · v1');
    await expect(page.getByTestId('doc-switcher')).toContainText('fund-iii-subscription-agreement');
  });
});
