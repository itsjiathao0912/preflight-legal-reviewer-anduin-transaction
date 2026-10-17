import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { changeRows } from './fixtures/variance';
import {
  askOwner,
  changeRow,
  gotoQuestions,
  openFundIIIvsII,
  ownerRows,
  recordAnswer,
} from './fixtures/variance-owners';

// Variance Phase 04 (AC-V12): Singapore (routed GP + Counsel) gives one GP question and one Counsel
// question, keyed `<findingId>@<owner>`, each answerable alone; one of two answered keeps it blocking.
test.describe('variance-two-owner-two-questions', () => {
  test('should give one question per (finding, owner) for a two-owner change, each answerable alone', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    const sing = changeRow(page, /Investor Domicile/);
    await expect(sing).toHaveCount(1);
    await expect(sing.getByTestId('owner-chip')).toHaveText('Counsel + GP');
    const id = await sing.getAttribute('data-finding-id');
    await askOwner(page, /Investor Domicile/);
    await expect(changeRows(page).filter({ hasText: /Investor Domicile/ })).toHaveAttribute(
      'data-status',
      'counsel',
    );

    await gotoQuestions(page);
    await expect(page.getByTestId('questions-tab-gp')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('questions-tab-counsel')).toHaveAttribute('data-count', '1');
    const gp = page.locator(`[data-testid="counsel-row"][data-key="${id}@gp"]`);
    const counsel = page.locator(`[data-testid="counsel-row"][data-key="${id}@counsel"]`);
    await expect(gp).toHaveCount(1);
    await expect(counsel).toHaveCount(1);
    await expect(gp).toHaveAttribute('data-finding-id', id!);

    // answer GP alone: GP resolved, Counsel still open and the finding still blocks
    await recordAnswer(page, gp, { option: 'A' });
    await expect(gp).toHaveAttribute('data-state', 'answered');
    await expect(counsel).toHaveAttribute('data-state', 'new');
    await expect(page.getByTestId('questions-tab-gp')).toHaveAttribute('data-count', '0');
    await expect(page.getByTestId('questions-tab-counsel')).toHaveAttribute('data-count', '1');
    await page.getByTestId('gate-button').click();
    await expect(
      page.locator(`[data-testid="gate-reason"][data-finding-id="${id}"][data-owner="counsel"]`),
    ).toHaveCount(1);
    await expect(
      page.locator(`[data-testid="gate-reason"][data-finding-id="${id}"][data-owner="gp"]`),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');

    // answer Counsel alone: no reason left for this finding
    await recordAnswer(page, counsel, { option: 'B' });
    await expect(counsel).toHaveAttribute('data-state', 'answered');
    await page.getByTestId('gate-button').click();
    await expect(page.locator(`[data-testid="gate-reason"][data-finding-id="${id}"]`)).toHaveCount(
      0,
    );
    await page.keyboard.press('Escape');
    await expect(ownerRows(page, 'gp')).toHaveCount(1);
  });
});
