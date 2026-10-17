import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp, row, rowsLoc } from './fixtures/app';
import { EXPECT, findingByQuote, openFund } from './fixtures/counsel';

// AC44: a finding dismissed at Fund I (Firm X) is not re-flagged at Fund II: it appears in
// "Previously handled (n)" for the identical passage, with the reason and the Fund I name.
const passage = (key: string) =>
  EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!;

test.describe('memory-no-reflag', () => {
  test('dismissed in the app at fund I shows as Previously handled at fund II with reason and fund', async ({
    page,
  }) => {
    await gotoApp(page);
    const quote = passage('p1-placeholder-insert').quote;
    const f1 = findingByQuote('fund-I', quote);
    const f2 = findingByQuote('fund-II', quote);
    await openFund(page, 'fund-I');
    await row(page, f1.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page, 'firm_standard_wording');

    await openFund(page, 'fund-II');
    await expect(row(page, f2.id)).toHaveCount(0);
    await expect(page.getByTestId('previously-handled-count')).toHaveText('1');
    await page.getByTestId('previously-handled-toggle').click();
    const item = page.locator(
      `[data-testid="previously-handled-item"][data-finding-id="${f2.id}"]`,
    );
    await expect(item).toHaveAttribute('data-memory-label', 'previously_dismissed');
    await expect(item).toContainText('Previously dismissed · Linh Tran · Demo Fund I');
    await expect(item).toContainText("Reason: Law firm's standard wording");
    await expect(rowsLoc(page)).toHaveCount(EXPECT.funds['fund-II'].findings - 1);
  });
});
