import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, hartwellFiles, runPackage, uploadPackage } from './fixtures/package';

// Intake Phase 3 track 3a (AC-I14): with the LPA in the package, "Units" is defined there, so no
// undefined-term finding is raised for it, and the lens shows "Defined in LPA" with the quote.
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
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-package').click();
    const units = page
      .getByTestId('package-term')
      .filter({ has: page.locator('strong', { hasText: /^Units$/ }) });
    await expect(units).toHaveAttribute('data-status', 'defined_in_package');
    await expect(units).toContainText('Defined in LPA');
    await expect(units.locator('q')).toContainText('means the limited partnership interests');
  });
});
