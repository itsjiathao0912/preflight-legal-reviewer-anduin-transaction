import { expect, test } from '@playwright/test';
import { gotoApp, rowsLoc } from './fixtures/app';
import {
  EXPECT,
  exportDocxText,
  findingByQuote,
  fundFindings,
  gotoCounsel,
  markCounsel,
  openFund,
  priorItem,
  seedFundI,
  trackOpenRouter,
} from './fixtures/counsel';
import { seedMemory } from './fixtures/seedMemory';

// AC45 + interim AC59/AC60: counsel answered at Fund I (Firm X) shows as Already answered at Fund II
// with the prior answer, is never re-asked in the exported DOCX, and the needs-action reduction
// matches fixtures/memory/fund-expectations.json `summary`.
const passage = (key: string) =>
  EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!;

test.describe('memory-prior-answer', () => {
  test('fund II: 8 findings, 5 handled by Fund I memory, 3 need action (62.5% fewer, >= 50%)', async ({
    page,
  }) => {
    const openrouter = trackOpenRouter(page);
    const s = EXPECT.summary;
    expect(s).toMatchObject({
      fund_II_findings: 8,
      handled: 5,
      need_action: 3,
      fewer_to_review_pct: 62.5,
    });
    expect(fundFindings('fund-II')).toHaveLength(s.fund_II_findings);
    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-II');
    await expect(page.getByTestId('previously-handled-count')).toHaveText(String(s.handled));
    await expect(rowsLoc(page)).toHaveCount(s.need_action);
    const handled = Number(await page.getByTestId('previously-handled-count').textContent());
    const shown = await rowsLoc(page).count();
    const pct = (handled / (handled + shown)) * 100;
    expect(pct).toBe(s.fewer_to_review_pct);
    expect(pct).toBeGreaterThanOrEqual(50);
    // every expected label lands on the right finding
    await page.getByTestId('previously-handled-toggle').click();
    for (const p of EXPECT.passages.filter((x) => x.fund === 'fund-II' && x.label !== 'new')) {
      const f = findingByQuote('fund-II', p.quote);
      await expect(
        page.locator(`[data-testid="previously-handled-item"][data-finding-id="${f.id}"]`),
      ).toHaveAttribute('data-memory-label', p.label);
    }
    expect(openrouter).toEqual([]);
  });

  test('already answered at fund I shows the prior answer and is not in the exported sheet', async ({
    page,
  }) => {
    await gotoApp(page);
    await seedFundI(page);
    await openFund(page, 'fund-II');
    const answered = ['p4-broken-conditional', 'p5-option-overlap'].map((k) =>
      findingByQuote('fund-II', passage(k).quote),
    );
    const edited = findingByQuote('fund-II', passage('p6-edited-section-ref').quote);
    await markCounsel(page, edited.id);
    await gotoCounsel(page);
    await page.getByTestId('counsel-prior-toggle').click();
    await expect(page.getByTestId('counsel-prior-toggle')).toContainText(
      `Already answered (${answered.length})`,
    );
    const p4 = priorItem(page, answered[0]!.id);
    await expect(p4).toHaveAttribute('data-kind', 'answered');
    await expect(p4).toContainText('Counsel chose A');
    await expect(p4).toContainText(EXPECT.funds['fund-I'].fund_name);
    await expect(priorItem(page, answered[1]!.id)).toContainText('Counsel chose B');

    const { text } = await exportDocxText(page);
    expect(text).toContain(edited.quote);
    for (const f of answered) expect(text).not.toContain(f.quote);
    expect(text).toContain('1 question for counsel');
  });

  test('awaiting counsel from fund I is not re-sent: it stays out of the sheet', async ({
    page,
  }) => {
    await gotoApp(page);
    const n1 = findingByQuote(
      'fund-II',
      EXPECT.passages.find((p) => p.key === 'n1-new-placeholder')!.quote,
    );
    const n2 = findingByQuote(
      'fund-II',
      EXPECT.passages.find((p) => p.key === 'n2-new-drafting-note')!.quote,
    );
    // an Accepted decision with no answer = Awaiting counsel (DATA-MODEL 2.3)
    await seedMemory(page, [
      { finding: n1, firmId: 'firm-x', decision: 'accepted', fund: 'Demo Fund I' },
    ]);
    await openFund(page, 'fund-II');
    await markCounsel(page, n2.id);
    await gotoCounsel(page);
    await page.getByTestId('counsel-prior-toggle').click();
    await expect(priorItem(page, n1.id)).toHaveAttribute('data-kind', 'awaiting');
    await page.getByTestId('counsel-export').click();
    await expect(page.getByTestId('export-left-out')).toContainText(
      'awaiting counsel, Demo Fund I',
    );
    await expect(
      page.locator(`[data-testid="export-item"][data-finding-id="${n1.id}"]`),
    ).toHaveCount(0);
    await page.getByTestId('export-close').click();
    const { text } = await exportDocxText(page);
    expect(text).toContain(n2.quote);
    expect(text).not.toContain(n1.quote);
  });
});
