import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blockOpenRouter, enableLane, forbidAi, interceptQuota } from './fixtures/ai';
import { gotoApp, openDialog } from './fixtures/app';

/**
 * AC23 / AC3 / AC4 (recorded OCR via route interception, zero live calls): a scanned page is
 * shown beside its OCR text with per-page progress, a confidence badge, a low-confidence marker
 * below 0.6 and a region highlight for the selected finding.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CROP = readFileSync(join(ROOT, 'fixtures', 'pdf', 'src', 'appa1-pg1-crop.jpg'));
const AUTHORED = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'llm-recordings', 'ocr', 'appa1-pg1.authored.json'), 'utf8'),
) as { result: { v: 1; pages: { index: number; lines: { text: string; conf?: number }[] }[] } };

/** The crop with an injected EXIF APP1 segment carrying a GPS-like marker (must not leave the browser). */
const EXIF_MARK = 'GPSLAT-SECRET-4242';
const exifPayload = Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from(EXIF_MARK)]);
const app1 = Buffer.concat([
  Buffer.from([0xff, 0xe1, (exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xff]),
  exifPayload,
]);
const CROP_EXIF = Buffer.concat([CROP.subarray(0, 2), app1, CROP.subarray(2)]);

async function interceptOcr(page: Page, data: unknown, gate: Promise<void>) {
  const calls: Buffer[] = [];
  await page.route('**/api/ocr', async (route, req) => {
    const body = req.postDataJSON() as { pages: { data_b64: string }[] };
    calls.push(Buffer.from(body.pages[0]!.data_b64, 'base64'));
    await gate;
    const frame = { t: 'result', kind: 'ocr', cache: 'miss', model: 'test', data };
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
      body: `${JSON.stringify(frame)}\n`,
    });
  });
  return calls;
}

async function uploadJpeg(page: Page) {
  await page
    .getByTestId('upload-input')
    .setInputFiles({ name: 'grid.jpg', mimeType: 'image/jpeg', buffer: CROP_EXIF });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Test Fund');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

test.describe('ocr-position-confidence', () => {
  test('shows per-page progress, the confidence badge and the region of the selected finding', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const openrouter = await blockOpenRouter(page);
    await forbidAi(page);
    await interceptQuota(page);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = await interceptOcr(page, AUTHORED.result, gate);
    await gotoApp(page);
    await enableLane(page);
    await openDialog(page);
    await uploadJpeg(page);

    // AC3: per-page progress while the page is being read
    const chip = page.getByTestId('scan-page-chip').first();
    await expect(page.getByTestId('scan-viewer')).toBeVisible({ timeout: 30_000 });
    await expect(chip).toHaveAttribute('data-state', 'running', { timeout: 30_000 });
    await expect(page.getByTestId('scan-page-image')).toBeVisible();
    release();
    await expect(chip).toHaveAttribute('data-state', 'done', { timeout: 60_000 });
    expect(calls).toHaveLength(1);
    // EXIF / GPS stripped by the canvas re-encode before egress
    expect(CROP_EXIF.includes(EXIF_MARK)).toBe(true);
    expect(calls[0]!.includes(EXIF_MARK)).toBe(false);
    expect(calls[0]!.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);

    // AC23: page image beside the text, page + confidence
    await expect(page.getByTestId('scan-text')).toContainText('Partnership/LLC');
    await expect(page.getByTestId('scan-text')).not.toContainText('^{');
    await expect(page.getByTestId('scan-confidence')).toHaveAttribute('data-low', 'false');
    await expect(page.getByTestId('scan-confidence')).toContainText('Confidence');
    await expect(page.getByTestId('scan-page-label')).toContainText('Page 1 of 1');

    // AC4: the selected finding (footnote 2 on the grid row) is outlined on the image
    const row = page.getByTestId('finding-row').first();
    await expect(row).toBeVisible();
    await row.click();
    const region = page.getByTestId('scan-region');
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute('data-kind', 'region');
    const img = (await page.getByTestId('scan-page-image').boundingBox())!;
    const box = (await region.boundingBox())!;
    expect(box.width).toBeGreaterThan(0);
    expect(box.width).toBeLessThan(img.width + 1);
    expect(box.y).toBeGreaterThan(img.y + img.height * 0.3); // grid row sits at y ~0.42
    expect(box.y).toBeLessThan(img.y + img.height * 0.55);
    await expect(page.getByTestId('scan-text-highlight')).toBeVisible();
    expect(openrouter).toEqual([]);
  });

  test('should mark a page below 0.6 confidence as low confidence', async ({ page }) => {
    test.setTimeout(90_000);
    await blockOpenRouter(page);
    await forbidAi(page);
    await interceptQuota(page);
    const low = {
      v: 1,
      pages: [
        {
          index: 0,
          lines: AUTHORED.result.pages[0]!.lines.map((l) => ({ text: l.text, conf: 0.3 })),
        },
      ],
    };
    await interceptOcr(page, low, Promise.resolve());
    await gotoApp(page);
    await enableLane(page);
    await openDialog(page);
    await uploadJpeg(page);
    await expect(page.getByTestId('scan-confidence')).toHaveAttribute('data-low', 'true', {
      timeout: 60_000,
    });
    await expect(page.getByTestId('scan-confidence')).toContainText('Low confidence');
    await expect(page.getByTestId('scan-low-confidence')).toBeVisible();
    await expect(page.getByTestId('scan-page-chip').first()).toHaveAttribute('data-low', 'true');
  });
});
