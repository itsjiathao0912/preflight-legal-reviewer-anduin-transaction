import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp, row } from './fixtures/app';
import { EXPECT, findingByQuote, openFund } from './fixtures/counsel';

// Session analyst name: default "Linh Tran", changed by a small inline edit on the sidebar badge
// that never blocks the shell; the stored name is used for memory decisions (decided_by_name).
test.describe('analyst-name', () => {
  test('defaults to Linh Tran; inline edit is optional and Escape keeps the name', async ({
    page,
  }) => {
    await gotoApp(page);
    await expect(page.getByTestId('analyst-name')).toHaveText('Linh Tran');
    // the shell works without ever touching the name
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    await page.getByTestId('analyst-name-edit').click();
    await page.getByTestId('analyst-name-input').fill('Someone Else');
    await page.getByTestId('analyst-name-input').press('Escape');
    await expect(page.getByTestId('analyst-name')).toHaveText('Linh Tran');
  });

  test('a changed name persists across reload and signs memory decisions', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('analyst-name-edit').click();
    await page.getByTestId('analyst-name-input').fill('  Minh Anh Nguyen  ');
    await page.getByTestId('analyst-name-input').press('Enter');
    await expect(page.getByTestId('analyst-name')).toHaveText('Minh Anh Nguyen');
    await page.reload();
    await expect(page.getByTestId('analyst-name')).toHaveText('Minh Anh Nguyen');

    const quote = EXPECT.passages.find((p) => p.key === 'p2-drafting-note')!.quote;
    await openFund(page, 'fund-I');
    await row(page, findingByQuote('fund-I', quote).id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'no_form_impact');
    await openFund(page, 'fund-II');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(
      page.locator(
        `[data-testid="previously-handled-item"][data-finding-id="${findingByQuote('fund-II', quote).id}"]`,
      ),
    ).toContainText('Previously dismissed · Minh Anh Nguyen · Demo Fund I');
  });
});
