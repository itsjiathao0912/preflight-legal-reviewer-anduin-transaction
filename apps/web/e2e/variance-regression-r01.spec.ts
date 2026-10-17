import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { changeRows } from './fixtures/variance';
import {
  askOwner,
  gotoQuestions,
  HC,
  openHc,
  recordFirmTemplateAnswer,
  stubRows,
} from './fixtures/variance-owners';

// Variance Phase 04 (AC-V16): R-01 end to end. A firm-template answer "Appendix C must exist" on the
// Fund II change (Appendix C removed vs Fund I) creates a check; Fund III without Appendix C shows a
// blocking "Regression: confirmed in Fund II" finding with the check quote; with Appendix C present
// there is none; another firm never runs it.
const regressionRows = (page: import('@playwright/test').Page) =>
  changeRows(page).filter({ hasText: 'Regression: confirmed in Fund II' });

test.describe('variance-regression-r01', () => {
  test('should show a blocking regression finding when Appendix C is missing, none when present, none for another firm', async ({
    page,
  }) => {
    await gotoApp(page);
    await openHc(page, 'fund-I.html', 'Fund I');
    await openHc(page, 'fund-II.html', 'Fund II');
    const removed = changeRows(page).filter({ hasText: /Appendix C/i });
    await expect(removed).toHaveCount(1);
    await askOwner(page, /Appendix C/i);
    await gotoQuestions(page);
    const q = page.getByTestId('counsel-row').first();
    await q.getByTestId('counsel-row-toggle').click();
    await q.getByTestId('counsel-record').click();
    await q.getByTestId('answer-scope-firm').check();
    await expect(q.getByTestId('assertion-preview')).toContainText('Appendix C must exist');
    await q.getByTestId('answer-cancel').click();
    await recordFirmTemplateAnswer(page, q, 'Every fund keeps the Appendix C questionnaire.');
    await expect
      .poll(async () =>
        (await stubRows<{ assertion_key: string; status: string }[]>(page, 'stub:checks'))
          .flat()
          .map((c) => [c.assertion_key, c.status]),
      )
      .toEqual([['appendix c', 'active']]);

    // Fund III (no Appendix C): blocking regression finding with the check statement as the quote
    await page.getByTestId('nav-findings').click();
    await openHc(page, 'fund-III.html', 'Fund III');
    const reg = regressionRows(page);
    await expect(reg).toHaveCount(1, { timeout: 20_000 });
    await expect(reg.getByTestId('change-type')).toContainText('Regression');
    await reg.click();
    await expect(page.getByTestId('finding-body')).toContainText('Appendix C must exist');
    const id = await reg.getAttribute('data-finding-id');
    expect(id).toMatch(/^f_[0-9a-f]{32}$/);
    await page.getByTestId('gate-button').click();
    await expect(
      page.locator('[data-testid="gate-group"][data-group="earlier"]').getByTestId('gate-reason'),
    ).toHaveAttribute('data-finding-id', id!);
    await page.keyboard.press('Escape');

    // Fund III with Appendix C: the check holds, no regression finding
    await openHc(page, 'fund-III-with-appendix-c.html', 'Fund III (with C)');
    await expect(changeRows(page).first()).toBeVisible();
    await page.waitForTimeout(2000);
    await expect(regressionRows(page)).toHaveCount(0);

    // another firm: the check never arrives (server-scoped by firm)
    await openHc(page, 'fund-III.html', 'Fund III', 'Firm X');
    await page.waitForTimeout(2000);
    await expect(changeRows(page)).toHaveCount(0);
    expect(HC).toBe('Hartwell & Crane LLP');
  });
});
