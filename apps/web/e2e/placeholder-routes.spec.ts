import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';

// Phase 02: Structure (with its Investor types sub-view) is a real view now (structure-view.spec.ts).
// Phase 07: Compare versions is a real view now (diff-pairs.spec.ts).
// Phase 08: Counsel questions is a real view now (counsel-*.spec.ts).
const ROUTES: [string, string][] = [
  ['memory', 'Firm memory'],
  ['documents', 'Documents'],
];

test.describe('placeholder-routes', () => {
  for (const [route, title] of ROUTES) {
    test(`${route} renders the placeholder view`, async ({ page }) => {
      await gotoApp(page);
      await page.getByTestId(`nav-${route}`).click();
      const v = page.locator(`[data-testid="placeholder-view"][data-route="${route}"]`);
      await expect(v).toBeVisible();
      await expect(v.locator('h1')).toHaveText(title);
      await expect(v).toContainText('coming in a later build');
      await expect(v.locator('a[href*="design"]')).toHaveCount(0);
      await expect(page.getByTestId('findings-header')).toHaveCount(0);
    });
  }
  test('Structure is no longer a placeholder', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
  test('counsel is no longer a placeholder', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    await expect(page.getByTestId('counsel-view').locator('h1')).toHaveText('Counsel questions');
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
  test('compare is no longer a placeholder', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-compare').click();
    await expect(page.getByTestId('compare-view')).toBeVisible();
    await expect(page.getByTestId('compare-view').locator('h1')).toHaveText('Compare versions');
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
});
