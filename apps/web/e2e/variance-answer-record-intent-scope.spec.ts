import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { askOwner, gotoQuestions, openFundIIIvsII } from './fixtures/variance-owners';

// Variance Phase 04 (AC-V14): the Record-answer dialog saves option (default marked), note, intent
// and scope; firm template is refused without an intent; the record shows who and when.
test.describe('variance-answer-record-intent-scope', () => {
  test('should record option, note, intent and scope and refuse firm_template without a trimmed intent', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    await askOwner(page, /Tax Status/);
    await gotoQuestions(page);
    const row = page.locator('[data-testid="counsel-row"][data-owner="counsel"]').first();
    await row.getByTestId('counsel-row-toggle').click();
    await row.getByTestId('counsel-record').click();
    const form = row.getByTestId('answer-form');
    // option A is the marked default
    await expect(form.getByTestId('answer-default')).toHaveText('Default');
    await expect(form.getByTestId('answer-option').first()).toBeChecked();
    await form.getByTestId('answer-option').nth(1).check();
    await form.getByTestId('answer-note').fill('Counsel confirmed on the call.');
    // firm template without an intent (whitespace only) is refused; nothing is recorded
    await form.getByTestId('answer-scope-firm').check();
    await expect(form.getByTestId('assertion-preview')).toHaveText(
      'No automatic check for this item.',
    );
    await form.getByTestId('answer-intent').fill('   ');
    await form.getByTestId('answer-save').click();
    await expect(form.getByTestId('answer-error')).toContainText('Add the intent');
    await expect(row.getByTestId('counsel-answer')).toHaveCount(0);
    // with an intent it saves
    await form.getByTestId('answer-intent').fill('Several tax statuses can apply to one investor.');
    await form.getByTestId('answer-by').fill('R. Whitlock, Hartwell & Crane LLP');
    await form.getByTestId('answer-save').click();
    const ans = row.getByTestId('counsel-answer');
    await expect(ans).toHaveAttribute('data-option', 'B');
    await expect(ans.getByTestId('answer-intent-view')).toHaveText(
      'Several tax statuses can apply to one investor.',
    );
    await expect(ans.getByTestId('answer-scope-view')).toHaveText('Firm template');
    await expect(ans).toContainText('Counsel confirmed on the call.');
    await expect(ans).toContainText('R. Whitlock, Hartwell & Crane LLP');
    await expect(ans).toContainText(/\d{1,2} \w{3} \d{4}/);
    await expect(row).toHaveAttribute('data-state', 'answered');

    // this-fund-only scope is the default for the next answer and needs no intent
    await row.getByTestId('counsel-record').click();
    await expect(form.getByTestId('answer-scope-firm')).toBeChecked();
    await form.getByTestId('answer-scope-fund').check();
    await form.getByTestId('answer-intent').fill('');
    await form.getByTestId('answer-save').click();
    await expect(ans.getByTestId('answer-scope-view')).toHaveText('This fund only');
    await expect(ans.getByTestId('answer-intent-view')).toHaveCount(0);
  });
});
