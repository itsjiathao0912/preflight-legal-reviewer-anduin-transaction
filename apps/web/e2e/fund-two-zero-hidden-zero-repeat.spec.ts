import { expect, test } from '@playwright/test';
import { gotoApp, row, rowsLoc } from './fixtures/app';
import {
  counselRow,
  EXPECT,
  exportDocxText,
  findingByQuote,
  gotoCounsel,
  markCounsel,
  openFund,
  seedFundI,
  trackOpenRouter,
} from './fixtures/counsel';
import { seedMemory } from './fixtures/seedMemory';

/**
 * AC60 final, on the seeded Fund I -> Fund II fixtures (`fixtures/memory/fund-expectations.json`,
 * read-only): 0 of the new defects and 0 edited passages land in Previously handled; 0 questions
 * already answered at Fund I reach the counsel sheet; blocking findings dismissed at Fund I stay in
 * the main list. Interim specs `memory-no-reflag` and `memory-blocking-never-hidden` stay.
 */
// `new` and `edited` are in the JSON summary but not in the shared fixture's type
const SUMMARY = EXPECT.summary as typeof EXPECT.summary & { new: number; edited: number };
const fundII = EXPECT.passages.filter((p) => p.fund === 'fund-II');
const handledIds = () =>
  fundII.filter((p) => p.label !== 'new').map((p) => findingByQuote('fund-II', p.quote).id);
const newIds = () =>
  fundII.filter((p) => p.label === 'new').map((p) => findingByQuote('fund-II', p.quote).id);
const prevItem = (page: import('@playwright/test').Page, id: string) =>
  page.locator(`[data-testid="previously-handled-item"][data-finding-id="${id}"]`);

test.describe('fund-two-zero-hidden-zero-repeat', () => {
  test('should place none of the new defects in Previously handled', async ({ page }) => {
    const openrouter = trackOpenRouter(page);
    // the fixture carries new defects and one edited passage (edited resolves to label "new")
    expect(fundII.filter((p) => p.category === 'new').length).toBe(SUMMARY.new);
    expect(fundII.filter((p) => p.category === 'edited').length).toBe(SUMMARY.edited);
    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-II');
    await page.getByTestId('previously-handled-toggle').click();
    await expect(page.getByTestId('previously-handled-item')).toHaveCount(EXPECT.summary.handled);
    for (const id of newIds()) {
      await expect(prevItem(page, id)).toHaveCount(0);
      await expect(row(page, id)).toBeVisible();
    }
    for (const id of handledIds()) {
      await expect(prevItem(page, id)).toHaveCount(1);
      await expect(row(page, id)).toHaveCount(0);
    }
    expect(openrouter).toEqual([]);
  });

  test('should never repeat a question already answered at fund I in the counsel sheet', async ({
    page,
  }) => {
    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-II');
    const answered = fundII
      .filter((p) => p.label === 'already_answered')
      .map((p) => findingByQuote('fund-II', p.quote));
    expect(answered.length).toBe(EXPECT.summary.already_answered);
    // every finding still needing action goes to counsel
    const ids = await rowsLoc(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id')!),
    );
    expect(ids.length).toBe(EXPECT.summary.need_action);
    for (const id of ids) await markCounsel(page, id);
    await gotoCounsel(page);
    await expect(page.getByTestId('counsel-row')).toHaveCount(ids.length);
    for (const f of answered) await expect(counselRow(page, f.id)).toHaveCount(0);
    const { text } = await exportDocxText(page);
    for (const f of answered) expect(text).not.toContain(f.quote);
    expect(text).toMatch(new RegExp(`\\b${ids.length} questions? for counsel`));
  });

  test('should keep blocking findings dismissed at fund I in the main list', async ({ page }) => {
    const blocking = fundII.filter(
      (p) => (p as { blocking?: boolean }).blocking && p.category !== 'edited',
    );
    expect(blocking.length).toBeGreaterThan(0);
    await gotoApp(page);
    await seedMemory(
      page,
      blocking.map((p) => ({
        finding: findingByQuote('fund-I', p.quote),
        firmId: 'firm-x',
        decision: 'dismissed' as const,
        fund: EXPECT.funds['fund-I'].fund_name,
        reason: 'other' as const,
      })),
    );
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('previously-handled-count')).toHaveText('0');
    for (const p of blocking) {
      const id = findingByQuote('fund-II', p.quote).id;
      await expect(row(page, id)).toBeVisible();
      await expect(prevItem(page, id)).toHaveCount(0);
    }
  });
});
