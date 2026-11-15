import { expect, test } from '@playwright/test';
import { limits } from '@aduin/core';
import { gotoApp, openDialog } from './fixtures/app';

const N = limits.visitorAiDocsPerDay;

test.describe('privacy-notice', () => {
  test('notice before the first upload states 24 hours and the daily allowance', async ({
    page,
  }) => {
    await gotoApp(page);
    await openDialog(page);
    // the notice (with "What gets sent?") appears once a file is chosen
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'a.htm', mimeType: 'text/html', buffer: Buffer.from('<p>Hello</p>') });
    const notice = page.getByTestId('privacy-notice');
    await notice.locator('summary').click();
    await expect(notice).toContainText(`${limits.browserUploadRetentionHours} hours`);
    await expect(notice).toContainText('24 hours');
    await expect(notice).toContainText(`Up to ${N} fresh-AI documents per day`);
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('Fund');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('upload-error')).toContainText('privacy notice');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
  });
  // (the allowance line and its "opening a cached sample does not use the allowance" case are gone
  // with the line itself: `ai-allowance` is no longer rendered anywhere)

  test('the AI switch persists across reload; switching AI on shows the notice first', async ({
    page,
  }) => {
    await gotoApp(page);
    await expect(page.getByTestId('ai-on')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('ai-off').click();
    await expect(page.getByTestId('ai-off-banner')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('ai-off')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ai-off-banner')).toBeVisible();
    await page.getByTestId('ai-on').click();
    await expect(page.getByTestId('privacy-prompt')).toBeVisible();
    await expect(page.getByTestId('privacy-prompt')).toContainText('24 hours');
    await page.getByTestId('privacy-accept').click();
    await expect(page.getByTestId('ai-on')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ai-off-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('ai-on')).toHaveAttribute('aria-pressed', 'true');
  });
});
