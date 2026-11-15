import { expect, test } from '@playwright/test';
import { gotoApp, openFindingsView } from './fixtures/app';
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
    await openFindingsView(page, 'sources');
    // package terms with no defining document are the Sources rows marked Unverified
    const terms = page.getByTestId('sources-row').filter({ hasText: 'Unverified' });
    await expect(terms.first()).toBeVisible();
    const n = await terms.count();
    for (let i = 0; i < n; i++) await expect(terms.nth(i)).toContainText('Unverified');
    await page.getByTestId('nav-documents').click();
    const line = (await page.getByTestId('package-summary-line').textContent()) ?? '';
    expect(Number(/(\d+) terms? unverified/.exec(line)?.[1])).toBe(n);
  });
});
