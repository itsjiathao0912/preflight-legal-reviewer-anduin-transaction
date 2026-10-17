import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3a (AC-I16): Hartwell Fund III alone (no LPA): the cross-document logic
// removes no finding, terms are listed as unverified with the reason, and the count matches the
// coverage line.
test.describe('intake-terms-unverified-without-lpa', () => {
  test('should list terms as unverified and counted, not flagged', async ({ page }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    // no finding removed: Units and Stock are both still flagged
    const titles = page.getByTestId('finding-title');
    await expect(
      titles.filter({ hasText: '"Units" is used for the offered security' }),
    ).toHaveCount(1);
    await expect(
      titles.filter({ hasText: '"Stock" is used for the offered security' }),
    ).toHaveCount(1);
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-package').click();
    const terms = page.getByTestId('package-term');
    await expect(terms.first()).toBeVisible();
    const n = await terms.count();
    await expect(
      page.locator('[data-testid="package-term"][data-status="unverified"]'),
    ).toHaveCount(n);
    for (let i = 0; i < n; i++)
      await expect(terms.nth(i)).toContainText('Unverified: No LPA in the package');
    const line = (await page.getByTestId('package-lens-line').textContent()) ?? '';
    expect(Number(/(\d+) terms? unverified/.exec(line)?.[1])).toBe(n);
  });
});
