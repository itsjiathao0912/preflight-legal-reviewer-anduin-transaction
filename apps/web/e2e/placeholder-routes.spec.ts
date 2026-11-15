import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';

// Phase 02: Structure (with its Investor types sub-view) is a real view now (structure-view.spec.ts).
// Phase 07: Compare versions is a real view now (diff-pairs.spec.ts).
// Phase 08: Counsel questions is a real view now (counsel-*.spec.ts).
// Phase 08b: Firm memory is a real view now (memory-ui-*.spec.ts).
// Documents is a real view now (lists this session's documents).

test.describe('placeholder-routes', () => {
  test('Documents is a real view with an empty state', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-documents').click();
    const v = page.getByTestId('documents-view');
    await expect(v).toBeVisible();
    await expect(v.locator('h1')).toHaveText('Documents');
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
  test('the old Document map route lands on Findings (Form flow)', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      location.hash = '#structure';
    });
    await expect(page.getByTestId('findings-header')).toBeVisible();
    await expect(page.getByTestId('nav-findings')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
  test('counsel is no longer a placeholder', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    await expect(page.getByTestId('counsel-view').locator('h1')).toHaveText('Requests');
    await expect(page.getByTestId('placeholder-view')).toHaveCount(0);
  });
  test('Memory is a real view', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-memory').click();
    await expect(page.getByTestId('memory-view')).toBeVisible();
    await expect(page.getByTestId('memory-view').locator('h1')).toHaveText('Firm memory');
    await expect(page.getByTestId('memory-no-firm')).toHaveText(
      'Open a document for a law firm to see its memory.',
    );
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
