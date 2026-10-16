import { expect, test } from '@playwright/test';
import { forceSeverity, gotoApp, openSample, rowsLoc } from './fixtures/app';

test.describe('filter-sort', () => {
  test('severity chips filter and their counts match the rows', async ({ page }) => {
    await gotoApp(page);
    await forceSeverity(page, 'critical', 0);
    await openSample(page, '03');
    await expect(page.getByTestId('severity-chip-block')).toContainText('Blocks 1');
    await expect(page.getByTestId('severity-chip-fix')).toContainText('Fix 1');
    await expect(page.getByTestId('severity-chip-note')).toContainText('Note 0');
    await page.getByTestId('severity-chip-block').click();
    await expect(page.getByTestId('severity-chip-block')).toHaveAttribute('aria-pressed', 'true');
    await expect(rowsLoc(page)).toHaveCount(1);
    await expect(rowsLoc(page).first()).toHaveAttribute('data-severity', 'block');
    await page.getByTestId('severity-chip-block').click();
    await expect(rowsLoc(page)).toHaveCount(2);
  });

  test('class, detector, status and sort live in the single Filter menu', async ({ page }) => {
    await gotoApp(page);
    await forceSeverity(page, 'medium', 0);
    await openSample(page, '03');
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-severity')),
    );
    expect(ids).toEqual(['fix', 'note']);
    await page.getByTestId('filter-button').click();
    await expect(page.getByTestId('filter-menu')).toBeVisible();
    await page.getByTestId('filter-sort').selectOption('doc');
    expect(
      await rowsLoc(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-severity'))),
    ).toEqual(['note', 'fix']);
    await page.getByTestId('filter-detector').selectOption('ref-label-coherence');
    await expect(rowsLoc(page)).toHaveCount(2);
    await page.getByTestId('filter-class').selectOption('broken_cross_reference');
    await expect(rowsLoc(page)).toHaveCount(2);
    await page.getByTestId('filter-status').selectOption('accepted');
    await expect(rowsLoc(page)).toHaveCount(0);
    await expect(page.getByTestId('empty-state')).toContainText('No findings match these filters.');
    await expect(page.getByTestId('filter-count')).toContainText('4');
    await page.getByTestId('filter-reset').click();
    await expect(page.getByTestId('filter-count')).toHaveCount(0);
    await expect(rowsLoc(page)).toHaveCount(2);
  });

  test('should keep filter state after reload', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('severity-chip-fix').click();
    await page.getByTestId('filter-button').click();
    await page.getByTestId('filter-status').selectOption('open');
    await page.getByTestId('filter-sort').selectOption('cls');
    await page.getByTestId('filter-detector').selectOption('ref-label-coherence');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByTestId('severity-chip-fix')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('filter-count')).toContainText('3');
    await openSample(page, '03');
    await page.getByTestId('filter-button').click();
    await expect(page.getByTestId('filter-status')).toHaveValue('open');
    await expect(page.getByTestId('filter-sort')).toHaveValue('cls');
    await expect(page.getByTestId('filter-detector')).toHaveValue('ref-label-coherence');
    await expect(rowsLoc(page)).toHaveCount(2);
  });

  test('J/K move the selection through the visible list', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')),
    );
    await page.locator('body').click({ position: { x: 600, y: 20 } });
    await page.keyboard.press('j');
    await expect(
      page.locator(`[data-testid=finding-row][data-finding-id="${ids[1]}"]`),
    ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('k');
    await expect(
      page.locator(`[data-testid=finding-row][data-finding-id="${ids[0]}"]`),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
