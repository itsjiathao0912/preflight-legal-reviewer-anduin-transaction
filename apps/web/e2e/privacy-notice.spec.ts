import { expect, test } from '@playwright/test';
import { limits } from '@aduin/core';
import { gotoApp, openDialog, openSample } from './fixtures/app';

const N = limits.visitorAiDocsPerDay;

test.describe('privacy-notice', () => {
  test('notice before the first upload states 24 hours and the daily allowance', async ({
    page,
  }) => {
    await gotoApp(page);
    await expect(page.getByTestId('ai-allowance')).toHaveText(
      `${N} of ${N} fresh-AI documents left today`,
    );
    await openDialog(page);
    const notice = page.getByTestId('privacy-notice');
    await expect(notice).toContainText(`${limits.browserUploadRetentionHours} hours`);
    await expect(notice).toContainText('24 hours');
    await expect(notice).toContainText(`Up to ${N} fresh-AI documents per day`);
    await page
      .getByTestId('upload-input')
      .setInputFiles({ name: 'a.htm', mimeType: 'text/html', buffer: Buffer.from('<p>Hello</p>') });
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('Fund');
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('upload-error')).toContainText('privacy notice');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
    await expect(page.getByTestId('ai-allowance')).toHaveText(
      `${N - 1} of ${N} fresh-AI documents left today`,
    );
  });

  test('opening a cached sample does not use the allowance', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '01');
    await openSample(page, '05');
    await expect(page.getByTestId('ai-allowance')).toHaveText(
      `${N} of ${N} fresh-AI documents left today`,
    );
  });

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
