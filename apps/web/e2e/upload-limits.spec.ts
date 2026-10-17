import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { limits } from '@aduin/core';
import { gotoApp, openDialog } from './fixtures/app';

const FIXTURES = resolve(import.meta.dirname, '..', '..', '..', 'fixtures');
const fixture = (...p: string[]) => readFileSync(join(FIXTURES, ...p));

async function readStage(page: Page) {
  await page.getByTestId('stage-status-button').click();
  return page.locator('[data-testid="stage-item"][data-stage="read"]');
}

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
    await upload(page, 'empty.pdf', Buffer.alloc(0), 'application/pdf');
    await expect(page.getByTestId('upload-error')).toContainText('empty');
    await expect(page.getByTestId('upload-error')).not.toContainText('later build');
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

  // Phase 06 (flipped from "supported in a later build"): PDF, Word and image files are accepted
  // and routed to the engine; the content is checked against the extension there.
  test('pdf, docx and png uploads route to the engine instead of a later-build message', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await gotoApp(page);
    await openDialog(page);
    await upload(page, 'text.pdf', fixture('pdf', 'text.pdf'), 'application/pdf');
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
      timeout: 60_000,
    });
    await openDialog(page);
    await upload(
      page,
      'form.docx',
      fixture('docx', 'legal-numbering.docx'),
      'application/octet-stream',
    );
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
    await expect(page.getByTestId('doc-pane')).toContainText('Definitions and Interpretation', {
      timeout: 60_000,
    });
    await openDialog(page);
    // a ".png" whose content is a PDF is refused by the content check (never OCR'd)
    await upload(page, 'page.png', Buffer.from('%PDF-1.4 not an image'), 'image/png');
    await expect(page.getByTestId('open-document-dialog')).toBeHidden();
    await expect(page.getByTestId('stage-status-button')).toContainText('Reading failed', {
      timeout: 30_000,
    });
    await expect(await readStage(page)).toContainText('does not match');
  });

  test('should refuse a 31-page scan before any OCR call', async ({ page }) => {
    test.setTimeout(90_000);
    const ocr: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/ocr')) ocr.push(r.url());
    });
    await gotoApp(page);
    await openDialog(page);
    await upload(page, 'pages-31.pdf', fixture('pdf', 'pages-31.pdf'), 'application/pdf');
    await expect(page.getByTestId('stage-status-button')).toContainText('Reading failed', {
      timeout: 60_000,
    });
    await expect(await readStage(page)).toContainText(`the limit is ${limits.maxScanPages} pages`);
    expect(ocr).toEqual([]);
  });
});
