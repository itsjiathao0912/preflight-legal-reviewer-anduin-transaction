import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { askOwner, gotoQuestions, openFundIIIvsII } from './fixtures/variance-owners';

// Variance Phase 04 (AC-V15): intent is human-entered. The field starts empty (no auto-fill), there
// is no AI draft path for change questions (0 AI calls), and whitespace-only intent is refused.
test.describe('variance-intent-human-only', () => {
  test('should never auto-fill intent and refuse whitespace-only intent', async ({ page }) => {
    const ai: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/ai')) ai.push(r.url());
    });
    await gotoApp(page);
    await openFundIIIvsII(page);
    await askOwner(page, /Investor Type/);
    await gotoQuestions(page);
    // change questions never get an AI draft: the AI draft action has nothing to draft
    await expect(page.getByTestId('counsel-ai-draft')).toBeDisabled();
    const row = page.locator('[data-testid="counsel-row"][data-owner="gp"]').first();
    await row.getByTestId('counsel-row-toggle').click();
    await expect(row.getByTestId('counsel-template-chip')).toBeVisible();
    await row.getByTestId('counsel-record').click();
    const intent = row.getByTestId('answer-intent');
    await expect(intent).toHaveValue('');
    await expect(intent).not.toHaveAttribute('placeholder', /.+/);
    await row.getByTestId('answer-scope-firm').check();
    await intent.fill(' \n\t ');
    await row.getByTestId('answer-save').click();
    await expect(row.getByTestId('answer-error')).toContainText('Add the intent');
    await expect(row.getByTestId('counsel-answer')).toHaveCount(0);
    // typing is the only way in
    await intent.fill('Trusts now split by revocability.');
    await row.getByTestId('answer-save').click();
    await expect(row.getByTestId('answer-intent-view')).toHaveText(
      'Trusts now split by revocability.',
    );
    expect(ai).toEqual([]);
  });
});
