import { expect, test } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';

// U1: an expanded finding shows a locator chip with its section path and paragraph number.
test.describe('locator-chip', () => {
  for (const id of ['01', '05']) {
    test(`sample #${id}: the locator chip names the section and paragraph`, async ({ page }) => {
      await gotoApp(page);
      await openSample(page, id);
      const rows = page.getByTestId('finding-row');
      await expect(rows.first()).toBeVisible();
      await rows.first().click();
      const chip = page.getByTestId('finding-locator');
      await expect(chip).toBeVisible();
      await expect(chip).toHaveText(/ · ¶ [1-9]\d*$/);
      await expect(chip).toHaveAttribute('aria-label', /^Location: .+, paragraph [1-9]\d*$/);
      const loc = (await page.getByTestId('finding-body').locator('.sub2').textContent()) ?? '';
      const num = /Section (\d+[A-Z]?)/.exec(loc)?.[1];
      if (num) await expect(chip).toContainText(num);
    });
  }
});
