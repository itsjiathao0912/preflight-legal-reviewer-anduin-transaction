import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, gotoApp } from './fixtures/app';
import { changeRows } from './fixtures/variance';
import {
  askOwner,
  changeRow,
  gotoQuestions,
  openFundIIIvsII,
  recordAnswer,
} from './fixtures/variance-owners';

// Variance Phase 04 (AC-V17): the gate counts untriaged changes and asked-unanswered questions;
// "unclear" stays blocking; exactly two states; cosmetic changes never block.
test.describe('variance-gate-two-states', () => {
  test('should keep the gate two-state with unclear blocking and cosmetic never blocking', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    const gate = page.getByTestId('gate-button');
    // 207 cosmetic changes are hidden and never block: Blocked = the 7 change rows
    await expect(gate).toContainText('Blocked · 7');
    // ask one owner, mark the other six as expected
    await askOwner(page, /Minimum Subscription/);
    const titles = await changeRows(page).evaluateAll((els) =>
      els.map((e) => e.querySelector('[data-testid="finding-title"]')?.textContent ?? ''),
    );
    for (const t of titles.filter((x) => !/Minimum Subscription/.test(x))) {
      await changeRow(page, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).click();
      await page.getByTestId('action-dismiss').click();
      await chooseReasonAndSave(page, 'firm_standard_wording');
    }
    await expect(gate).toContainText('Blocked · 1');
    // "unclear" keeps it blocking
    await gotoQuestions(page);
    const q = page.locator('[data-testid="counsel-row"][data-owner="gp"]').first();
    await recordAnswer(page, q, { option: 'unclear' });
    await expect(q).toHaveAttribute('data-state', 'unclear');
    await expect(gate).toContainText('Blocked · 1');
    await gate.click();
    await expect(page.getByTestId('gate-reason')).toHaveAttribute('data-kind', 'unclear');
    await page.keyboard.press('Escape');
    // a clear answer: Ready (the only other state)
    await q.getByTestId('counsel-record').click();
    await q.getByTestId('answer-option').first().check();
    await q.getByTestId('answer-save').click();
    await expect(gate).toHaveText(/Ready to digitize/);
    await expect(gate).not.toContainText('Blocked');
  });
});
