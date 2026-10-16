import { expect, test, type Page } from '@playwright/test';
import { limits } from '@aduin/core';
import { gotoApp, openDialog } from './fixtures/app';

async function upload(page: Page, name: string, buffer: Buffer, mimeType = 'text/html') {
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType, buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

function htmlOfSize(n: number): Buffer {
  const head = '<html><body><p>Section 1. Limit test paragraph.</p><!--';
  const tail = '--></body></html>';
  return Buffer.concat([
    Buffer.from(head),
    Buffer.alloc(n - head.length - tail.length, 'x'),
    Buffer.from(tail),
  ]);
}

test.describe('upload-limits', () => {
  test('limits are stated from core limits', async ({ page }) => {
    await gotoApp(page);
    await openDialog(page);
    const mb = Math.round(limits.maxUploadBytes / (1024 * 1024));
    await expect(page.getByTestId('limits-copy')).toContainText(`Up to ${mb} MB`);
    await expect(page.getByTestId('limits-copy')).toContainText(`${limits.maxScanPages} pages`);
    for (const ext of limits.uploadExtensions)
      await expect(page.getByTestId('limits-copy')).toContainText(ext);
  });

  test('over the limit, wrong type and empty files are refused before any AI call', async ({
    page,
  }) => {
    await gotoApp(page);
    await openDialog(page);
    await upload(page, 'big.htm', htmlOfSize(limits.maxUploadBytes + 1));
    await expect(page.getByTestId('upload-error')).toContainText('over the 10 MB limit');
    await upload(page, 'notes.txt', Buffer.from('hello'), 'text/plain');
    await expect(page.getByTestId('upload-error')).toContainText('not supported');
    await upload(page, 'empty.html', Buffer.alloc(0));
    await expect(page.getByTestId('upload-error')).toContainText('empty');
    await upload(page, 'scan.pdf', Buffer.from('%PDF-1.4'), 'application/pdf');
    await expect(page.getByTestId('upload-error')).toContainText('supported in a later build');
    await upload(page, 'form.docx', Buffer.from('PK'), 'application/octet-stream');
    await expect(page.getByTestId('upload-error')).toContainText('supported in a later build');
    await upload(page, 'page.png', Buffer.from([0x89, 0x50]), 'image/png');
    await expect(page.getByTestId('upload-error')).toContainText('supported in a later build');
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    await expect(page.getByTestId('ai-allowance')).toContainText(
      `${limits.visitorAiDocsPerDay} of ${limits.visitorAiDocsPerDay}`,
    );
  });

  test('a file exactly at the limit is accepted and opens', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoApp(page);
    await openDialog(page);
    await upload(page, 'at-limit.htm', htmlOfSize(limits.maxUploadBytes));
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('doc-pane')).toContainText('Limit test paragraph');
  });
});
