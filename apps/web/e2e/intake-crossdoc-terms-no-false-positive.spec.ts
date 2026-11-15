import { expect, test } from '@playwright/test';
import { gotoApp, openFindingsView } from './fixtures/app';
import { confirmAllRows, hartwellFiles, runPackage, uploadPackage } from './fixtures/package';

// Intake Phase 3 track 3a (AC-I14): with the LPA in the package, "Units" is defined there, so no
// undefined-term finding is raised for it, and Sources shows the term as defined in the LPA with an Open action.
test.describe('intake-crossdoc-terms-no-false-positive', () => {
  test('should not flag Units when the LPA defines it', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await confirmAllRows(page);
    await runPackage(page);
    const titles = page.getByTestId('finding-title');
    await expect(
      titles.filter({ hasText: '"Stock" is used for the offered security' }),
    ).toHaveCount(1);
    await expect(
      titles.filter({ hasText: '"Units" is used for the offered security' }),
    ).toHaveCount(0);
    await openFindingsView(page, 'sources');
    const units = page
      .getByTestId('sources-row')
      .filter({ has: page.locator('td:first-child', { hasText: /^Units$/ }) });
    await expect(units).toContainText('Term · LPA');
    await expect(units).toContainText('Defined');
    await expect(units.getByTestId('sources-open-file')).toBeVisible();
  });
});
