import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blockOpenRouter, enableLane, forbidAi, interceptQuota } from './fixtures/ai';
import { gotoApp, openDialog } from './fixtures/app';

/**
 * Phase 06d render path (recorded OCR via route interception, zero live calls): the scan page of
 * a PDF / a JPEG upload is rendered in the browser, downscaled, re-encoded as JPEG and posted to
 * /api/ocr. The PDF itself is never posted. OCR lines come back into the engine worker.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const fixture = (...p: string[]) => readFileSync(join(ROOT, 'fixtures', ...p));
const RECORDED = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'llm-recordings', 'ocr', 'appa1-pg1.authored.json'), 'utf8'),
) as { result: unknown };

interface OcrCall {
  mime: string;
  b64Head: string;
  bytes: number;
  index: number;
  header: string | undefined;
}

async function interceptOcr(page: Page): Promise<OcrCall[]> {
  const calls: OcrCall[] = [];
  await page.route('**/api/ocr', async (route, req) => {
    const body = req.postDataJSON() as {
      mime: string;
      pages: { index: number; data_b64: string }[];
    };
    const p = body.pages[0]!;
    calls.push({
      mime: body.mime,
      b64Head: p.data_b64.slice(0, 8),
      bytes: Math.floor((p.data_b64.length * 3) / 4),
      index: p.index,
      header: req.headers()['x-aduin-client'],
    });
    const frame = { t: 'result', kind: 'ocr', cache: 'miss', model: 'test', data: RECORDED.result };
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
      body: `${JSON.stringify(frame)}\n`,
    });
  });
  return calls;
}

async function upload(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType, buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

test.describe('ocr-render-path', () => {
  for (const c of [
    { name: 'scanned.pdf', file: fixture('pdf', 'scanned.pdf'), mime: 'application/pdf' },
    { name: 'grid.jpg', file: fixture('pdf', 'src', 'appa1-pg1-crop.jpg'), mime: 'image/jpeg' },
  ]) {
    test(`renders ${c.name} to a JPEG page image and never posts the original`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const openrouter = await blockOpenRouter(page);
      await forbidAi(page);
      await interceptQuota(page);
      const calls = await interceptOcr(page);
      await gotoApp(page);
      await enableLane(page);
      await openDialog(page);
      await upload(page, c.name, c.file, c.mime);
      await expect(page.getByTestId('doc-pane')).toContainText('Partnership/LLC', {
        timeout: 60_000,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.mime).toBe('image/jpeg');
      expect(calls[0]!.b64Head.startsWith('/9j/')).toBe(true); // JPEG magic, base64
      expect(calls[0]!.b64Head.startsWith('JVBER')).toBe(false); // never "%PDF"
      expect(calls[0]!.index).toBe(0);
      expect(calls[0]!.header).toBe('1');
      expect(calls[0]!.bytes).toBeLessThan(700 * 1024);
      expect(openrouter).toEqual([]);
      await expect(page.getByTestId('doc-pane')).not.toContainText('^{');
    });
  }
});
