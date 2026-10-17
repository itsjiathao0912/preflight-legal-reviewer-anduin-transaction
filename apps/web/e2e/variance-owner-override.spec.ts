import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { varianceSettled } from './fixtures/variance';
import {
  askOwner,
  changeRow,
  gotoQuestions,
  openFundIIIvsII,
  recordAnswer,
  stubRows,
} from './fixtures/variance-owners';

// Variance Phase 04 (AC-V11): the owner is suggested by the routing table; the analyst override is
// saved (uiState, survives a reload), recorded as owner_source "override" when the question is
// created, and read-only once asked. "You" is local-only: Ask owner is disabled.
const TAX = /Tax Status/;
const BENEFICIAL = /Beneficial Owners/;

test.describe('variance-owner-override', () => {
  test('should save an owner override and record owner_source override at ask time', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    const tax = changeRow(page, TAX);
    // suggested by the routing table
    await expect(tax.getByTestId('owner-chip')).toHaveText('Counsel');
    await expect(tax.getByTestId('owner-chip')).toHaveAttribute('data-owner-source', 'suggested');
    await tax.click();
    const body = page.getByTestId('finding-body');
    await expect(body.getByTestId('owner-reason')).toContainText('Suggested: Counsel.');
    await body.getByTestId('owner-select').selectOption('gp');
    await expect(tax.getByTestId('owner-chip')).toHaveText('GP');
    await expect(tax.getByTestId('owner-chip')).toHaveAttribute('data-owner-source', 'override');

    // the override survives a reload (uiState variance:owner:{docId})
    await page.reload();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    await varianceSettled(page);
    await expect(changeRow(page, TAX).getByTestId('owner-chip')).toHaveText('GP');

    // "You" is local-only: Ask owner is disabled with a reason, nothing is asked
    await changeRow(page, BENEFICIAL).click();
    await page.getByTestId('finding-body').getByTestId('owner-select').selectOption('you');
    await expect(changeRow(page, BENEFICIAL).getByTestId('owner-chip')).toHaveText('You');
    // the sticky bar sits outside the expanded body (Findings v2)
    const ask = page.getByTestId('action-counsel');
    await expect(ask).toBeDisabled();
    await expect(ask).toHaveAttribute('title', 'Change the owner first');

    // ask the overridden owner: the select becomes read-only
    await askOwner(page, TAX);
    await expect(changeRow(page, TAX)).toHaveAttribute('data-status', 'counsel');
    // Findings v2 moves to the next row after an action: re-open Tax Status to read its select
    if ((await changeRow(page, TAX).getAttribute('aria-expanded')) !== 'true')
      await changeRow(page, TAX).click();
    await expect(changeRow(page, TAX)).toHaveAttribute('aria-expanded', 'true');
    const sel = page.getByTestId('finding-body').getByTestId('owner-select');
    await expect(sel).toBeDisabled();
    await expect(sel).toHaveAttribute('title', /already asked/);

    // Questions: the GP question exists; answering creates the question with owner_source override
    await gotoQuestions(page);
    const gpRows = page.locator('[data-testid="counsel-row"][data-owner="gp"]');
    await expect(gpRows).toHaveCount(1);
    await expect(page.locator('[data-testid="counsel-row"][data-owner="counsel"]')).toHaveCount(0);
    await recordAnswer(page, gpRows.first(), { option: 'A' });
    await expect
      .poll(async () =>
        (
          await stubRows<{ owner?: string; owner_source?: string; finding_ref: string }>(
            page,
            'stub:question:',
          )
        ).map((q) => [q.finding_ref.endsWith('@gp'), q.owner, q.owner_source]),
      )
      .toEqual([[true, 'gp', 'override']]);
  });
});
