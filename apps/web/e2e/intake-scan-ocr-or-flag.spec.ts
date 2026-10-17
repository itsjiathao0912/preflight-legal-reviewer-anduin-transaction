import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFile,
  openDemoPackage,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 2 H4 (AC-I3): a scanned member reuses the OCR path (precomputed) or shows "needs OCR".
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const CROP = readFileSync(join(ROOT, 'fixtures', 'pdf', 'src', 'appa1-pg1-crop.jpg'));

function countApi(page: Page) {
  const seen = { ai: 0, ocr: 0 };
  page.on('request', (r) => {
    if (r.url().includes('/api/ai')) seen.ai++;
    if (r.url().includes('/api/ocr')) seen.ocr++;
  });
  return seen;
}

async function storedPackages(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ docs: { needsOcr: boolean; format: string }[] }[]>((done) => {
        const req = indexedDB.open('aduin-web');
        req.onsuccess = () => {
          const db = req.result;
          if (![...db.objectStoreNames].includes('packages')) return done([]);
          const all = db.transaction('packages').objectStore('packages').getAll();
          all.onsuccess = () => done(all.result as never);
        };
        req.onerror = () => done([]);
      }),
  );
}

test.describe('intake-scan-ocr-or-flag', () => {
  test('should open rw-scans from precomputed OCR with zero ocr requests and flag an uploaded image member as needs OCR', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const seen = countApi(page);
    await gotoApp(page);
    await openDemoPackage(page, 'rw-scans');
    const table = page.getByTestId('package-confirm-table');
    await expect
      .poll(
        async () =>
          (await page.getByTestId('package-row').count()) > 0 ||
          !(await page.getByTestId('open-document-dialog').isVisible()),
        { timeout: 60_000 },
      )
      .toBe(true);
    if (await table.isVisible()) {
      await expect(page.getByTestId('package-row')).toHaveCount(1, { timeout: 60_000 });
      const row = page.getByTestId('package-row');
      await row.getByTestId('package-row-type').selectOption('sub_agreement');
      await row.getByTestId('package-row-role').selectOption('to_digitize');
      await confirmAllRows(page);
      await page.getByTestId('package-version-input').fill('scan set');
      await runPackage(page);
    } else {
      await waitForChecks(page);
    }
    await expect
      .poll(
        async () => (await storedPackages(page)).flatMap((p) => p.docs).map((d) => d.needsOcr),
        {
          timeout: 30_000,
        },
      )
      .toEqual([false]);
    expect(seen.ocr).toBe(0);

    // uploaded JPEG + LPA + subscription agreement: the image row needs OCR, the run still works
    await uploadPackage(
      page,
      [
        { name: 'scan.jpg', buffer: CROP, mimeType: 'image/jpeg' },
        hartwellFile('northgate-lpa-definitions.docx'),
        hartwellFile('fund-iii-subscription-agreement.html'),
      ],
      { firm: 'Other / no firm', fund: 'Hartwell Fund III', version: 'v1' },
    );
    const img = page.getByTestId('package-row').filter({ hasText: 'scan.jpg' });
    await expect(img).toHaveAttribute('data-needs-ocr', 'true');
    await expect(img).toContainText('needs OCR');
    await confirmAllRows(page);
    await runPackage(page);
    await expect(page.getByTestId('finding-row').first()).toBeVisible();
    expect(seen.ocr).toBe(0);
    expect(seen.ai).toBe(0);
  });
});
