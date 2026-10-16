import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';

const ROUTES: [string, string][] = [
  ['counsel', 'Counsel questions'],
  ['structure', 'Structure'],
  ['compare', 'Compare versions'],
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
  test('Structure placeholder covers the Investor types sub-view', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('placeholder-view')).toContainText('Investor types');
  });
});
