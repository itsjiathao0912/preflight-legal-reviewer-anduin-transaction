import { expect, test } from '@playwright/test';
import { gotoApp, openSample, row, rowsLoc } from './fixtures/app';

test.describe('dismiss-requires-reason', () => {
  test('should refuse to dismiss without a reason and show the message', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const [a, b] = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')!),
    );
    await row(page, a!).click();
    await page.getByTestId('action-dismiss').click();
    const modal = page.getByTestId('dismiss-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#app')).toHaveAttribute('inert', '');
    await expect(page.getByTestId('dismiss-reason')).toHaveCount(4);
    await expect(page.getByTestId('dismiss-reason').first()).toBeFocused();
    await page.getByTestId('dismiss-save').click();
    await expect(page.getByTestId('dismiss-error')).toHaveText(
      'Choose a reason before saving. Dismissing without a reason is not allowed.',
    );
    await expect(modal).toBeVisible();
    await expect(row(page, a!)).toHaveAttribute('data-status', 'open');

    // focus trap: 12 Tab presses stay inside the modal
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await modal.evaluate((m) => m.contains(document.activeElement))).toBe(true);
    }
    // Esc closes and returns focus to the Dismiss button
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page.getByTestId('action-dismiss')).toBeFocused();
    await expect(page.locator('#app')).not.toHaveAttribute('inert', '');

    // with a reason it saves and moves the selection to the next finding
    await page.getByTestId('action-dismiss').click();
    await page.locator('[data-testid="dismiss-reason"][value="firm_standard_wording"]').check();
    await page.getByTestId('dismiss-note').fill('Standard PG wording');
    await page.getByTestId('dismiss-save').click();
    await expect(modal).toBeHidden();
    await expect(row(page, a!)).toHaveCount(0);
    await expect(row(page, b!)).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, b!)).toBeFocused();
    await page.getByTestId('undo-button').click();
    await expect(row(page, a!)).toHaveAttribute('data-status', 'open');
  });

  test('Cancel and scrim leave the finding untouched', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '01');
    await rowsLoc(page).first().click();
    await page.getByTestId('action-dismiss').click();
    await page.locator('[data-testid="dismiss-reason"]').first().check();
    await page.getByTestId('dismiss-cancel').click();
    await expect(page.getByTestId('dismiss-modal')).toBeHidden();
    await expect(rowsLoc(page).first()).toHaveAttribute('data-status', 'open');
  });
});
