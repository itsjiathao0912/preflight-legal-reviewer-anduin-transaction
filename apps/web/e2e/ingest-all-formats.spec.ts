import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blockOpenRouter, enableLane, forbidAi, interceptQuota } from './fixtures/ai';
import { gotoApp, openDialog } from './fixtures/app';

/**
 * AC1 (browser render paths): HTML, text PDF, DOCX, scanned PDF and image fixtures each open in
 * the review view; corrupt and encrypted files give a clear message with no crash. OCR answers
 * are recorded (route interception); zero live calls.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const fx = (...p: string[]) => readFileSync(join(ROOT, 'fixtures', ...p));
const HTML = readFileSync(
  join(ROOT, 'packages', 'core', 'test', 'fixtures', 'sections-parts.html'),
);
const RECORDED = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'llm-recordings', 'ocr', 'appa1-pg1.authored.json'), 'utf8'),
) as { result: unknown };

async function upload(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType, buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
}

test.describe('ingest-all-formats', () => {
  test('should open an html text pdf docx scanned pdf and image fixture', async ({ page }) => {
    test.setTimeout(150_000);
    const openrouter = await blockOpenRouter(page);
    await forbidAi(page);
    await interceptQuota(page);
    await page.route('**/api/ocr', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
        body: `${JSON.stringify({ t: 'result', kind: 'ocr', cache: 'miss', model: 'test', data: RECORDED.result })}\n`,
      }),
    );
    await gotoApp(page);
    await enableLane(page);
    const done = () =>
      expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
        timeout: 60_000,
      });

    await upload(page, 'form.html', HTML, 'text/html');
    await done();
    await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();

    await upload(page, 'text.pdf', fx('pdf', 'text.pdf'), 'application/pdf');
    await done();
    await expect(page.getByTestId('scan-viewer')).toHaveCount(0);

    await upload(page, 'form.docx', fx('docx', 'legal-numbering.docx'), 'application/octet-stream');
    await done();
    await expect(page.getByTestId('numbering-notice')).toContainText('Numbering reconstructed');

    await upload(page, 'scanned.pdf', fx('pdf', 'scanned.pdf'), 'application/pdf');
    await done();
    await expect(page.getByTestId('scan-viewer')).toBeVisible();
    await expect(page.getByTestId('scan-page-image')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('scan-text')).toContainText('Partnership/LLC');

    await upload(page, 'grid.jpg', fx('pdf', 'src', 'appa1-pg1-crop.jpg'), 'image/jpeg');
    await done();
    await expect(page.getByTestId('scan-page-image')).toBeVisible();
    await expect(page.getByTestId('scan-text')).toContainText('Partnership/LLC');
    expect(openrouter).toEqual([]);
  });

  test('should reject a corrupt file with a clear message', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoApp(page);
    for (const c of [
      { name: 'corrupt.pdf', file: fx('pdf', 'corrupt.pdf'), mime: 'application/pdf' },
      { name: 'encrypted.pdf', file: fx('pdf', 'encrypted.pdf'), mime: 'application/pdf' },
      { name: 'corrupt.docx', file: fx('docx', 'corrupt.docx'), mime: 'application/octet-stream' },
    ]) {
      await upload(page, c.name, c.file, c.mime);
      await expect(page.getByTestId('stage-status-button')).toContainText('Reading failed', {
        timeout: 60_000,
      });
      await expect(page.getByTestId('app-shell')).toBeVisible();
    }
  });
});
