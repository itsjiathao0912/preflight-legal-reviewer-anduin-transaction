import { expect, test } from '@playwright/test';
import { gotoApp, rowsLoc } from './fixtures/app';
import { EXPECT, findingByQuote, openFund, seedFundI } from './fixtures/counsel';

// AC47 (preview twin; the real-Worker twin is stack-memory-memory-no-cross-firm): Firm X decisions
// never apply to Firm Y, even for the identical passages.
test.describe('memory-no-cross-firm', () => {
  test('fund Y (Firm Y) shows every finding as New despite Firm X memory on the same passages', async ({
    page,
  }) => {
    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-Y');
    await expect(page.getByTestId('doc-switcher')).toContainText('Firm Y');
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
    await expect(rowsLoc(page)).toHaveCount(EXPECT.funds['fund-Y'].findings);
    for (const p of EXPECT.passages.filter((x) => x.fund === 'fund-Y')) {
      expect(p.label).toBe('new');
      const f = findingByQuote('fund-Y', p.quote);
      await expect(rowsLoc(page).and(page.locator(`[data-finding-id="${f.id}"]`))).toHaveCount(1);
    }
    // the same memory still applies to Firm X (the seed is live)
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('previously-handled-count')).toHaveText(
      String(EXPECT.summary.handled),
    );
  });
});
