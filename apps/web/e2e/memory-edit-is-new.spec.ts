import { expect, test } from '@playwright/test';
import { gotoApp, row } from './fixtures/app';
import { EXPECT, findingByQuote, openFund, seedFundI } from './fixtures/counsel';

// AC46: an edited passage is a new finding. Fund I's "complete Section 4." was answered by counsel;
// Fund II says "complete Section 5." (fingerprint mismatch), so it is New, in the main list, and gates.
test.describe('memory-edit-is-new', () => {
  test('Section 4 changed to Section 5 is New at fund II even though fund I was answered', async ({
    page,
  }) => {
    const edited = EXPECT.passages.find(
      (p) => p.key === 'p6-edited-section-ref' && p.fund === 'fund-II',
    )!;
    expect(edited).toMatchObject({ category: 'edited', label: 'new' });
    const f2 = findingByQuote('fund-II', edited.quote);
    expect(f2.quote).toContain('Section 5');
    const f1 = findingByQuote('fund-I', 'If the Subscriber is an IRA, complete Section 4.');
    expect(f1.quote_hash).not.toBe(f2.quote_hash);

    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-II');
    await expect(row(page, f2.id)).toBeVisible();
    await row(page, f2.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText('New');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(
      page.locator(`[data-testid="previously-handled-item"][data-finding-id="${f2.id}"]`),
    ).toHaveCount(0);
    await page.getByTestId('gate-button').click();
    await expect(
      page.locator(`[data-testid="gate-reason"][data-finding-id="${f2.id}"]`),
    ).toHaveAttribute('data-kind', 'open');
  });
});
