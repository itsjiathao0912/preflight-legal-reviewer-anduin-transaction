import { expect, test } from '@playwright/test';
import { gotoApp, rowsLoc } from './fixtures/app';
import { EXPECT, fundFindings, openFund, seedFundI, trackOpenRouter } from './fixtures/counsel';

/**
 * AC59 final: Fund II (Firm X) shows at least 50% fewer findings needing action WITH Fund I memory
 * than WITHOUT it. Both sides are measured in the same browser context on the real engine output of
 * `fixtures/memory/fund-II.html`; the expected numbers come from `fixtures/memory/fund-expectations.json`
 * (generated from engine output, read-only). The interim `memory-prior-answer` spec stays.
 */
test.describe('fund-two-memory-reduction', () => {
  test('should show at least 50 percent fewer findings needing action at fund II', async ({
    page,
  }) => {
    const openrouter = trackOpenRouter(page);
    const s = EXPECT.summary;
    expect(fundFindings('fund-II')).toHaveLength(s.fund_II_findings);

    // without memory: every Fund II finding needs action
    await gotoApp(page);
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
    await expect(rowsLoc(page)).toHaveCount(s.fund_II_findings);
    const without = await rowsLoc(page).count();

    // with Fund I memory (decisions + counsel answers, engine fingerprints)
    await seedFundI(page);
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('previously-handled-count')).toHaveText(String(s.handled));
    await expect(rowsLoc(page)).toHaveCount(s.need_action);
    const withMemory = await rowsLoc(page).count();

    const fewerPct = ((without - withMemory) / without) * 100;
    console.log(
      `[fund-two] needs action without memory ${without}, with memory ${withMemory}: ${fewerPct}% fewer`,
    );
    expect(fewerPct).toBe(s.fewer_to_review_pct);
    expect(fewerPct).toBeGreaterThanOrEqual(50);
    expect(openrouter).toEqual([]);
  });
});
