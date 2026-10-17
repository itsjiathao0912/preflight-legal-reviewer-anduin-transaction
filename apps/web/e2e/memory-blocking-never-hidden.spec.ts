import { expect, test } from '@playwright/test';
import { gotoApp, row } from './fixtures/app';
import { EXPECT, findingByQuote, openFund } from './fixtures/counsel';
import { seedMemory } from './fixtures/seedMemory';

// AC48: a blocking finding dismissed at Fund I is never hidden at Fund II: it stays in the main list
// labelled "Dismissed in [old fund], re-confirm" and the gate stays unresolved until re-confirmed
// (the re-confirm flow itself is in counsel-gate).
test.describe('memory-blocking-never-hidden', () => {
  test('critical dismissed at fund I stays in the main list labelled re-confirm and gates', async ({
    page,
  }) => {
    const p = EXPECT.passages.find(
      (x) => x.key === 'p4-broken-conditional' && x.fund === 'fund-II',
    )!;
    const f1 = findingByQuote('fund-I', p.quote);
    const f2 = findingByQuote('fund-II', p.quote);
    expect(f2.severity).toBe('critical');
    await gotoApp(page);
    await seedMemory(page, [
      {
        finding: f1,
        firmId: 'firm-x',
        decision: 'dismissed',
        fund: 'Demo Fund I',
        reason: 'other',
      },
    ]);
    await openFund(page, 'fund-II');
    await expect(row(page, f2.id)).toBeVisible();
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
    await row(page, f2.id).click();
    await expect(page.getByTestId('finding-memory-tag')).toHaveText(
      'Dismissed in Demo Fund I, re-confirm',
    );
    await page.getByTestId('gate-button').click();
    await expect(
      page.locator(`[data-testid="gate-reason"][data-finding-id="${f2.id}"]`),
    ).toHaveAttribute('data-kind', 'reconfirm_required');
    await page.keyboard.press('Escape');
    // the default status filter never hides it, and neither does a reload
    await page.reload();
    await openFund(page, 'fund-II');
    await expect(row(page, f2.id)).toBeVisible();
  });
});
