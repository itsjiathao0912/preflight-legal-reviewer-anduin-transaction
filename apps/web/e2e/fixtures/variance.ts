import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { openDialog } from './app';
import { RAW_DIR, waitForChecks, type UploadFile } from './package';

/**
 * Variance Phase 02: shared two-document loader and variance helpers (V2-owned; V4 and V5 append
 * only). Uploads go through the real Open a document flow with a chosen firm.
 */
export const NGI_2024 = '05-partners-group-ngi-2024.htm';
export const NGI_2026 = '06-partners-group-ngi-2026.htm';

export function rawFile(name: string, as?: string): UploadFile {
  return { name: as ?? name, buffer: readFileSync(join(RAW_DIR, name)) };
}

export function scanPage(): UploadFile {
  return {
    name: 'scanned-page.jpg',
    buffer: readFileSync(join(RAW_DIR, '09-rw-holdings-scans', 'appa1-pg1.jpg')),
    mimeType: 'image/jpeg',
  };
}

const MIME: Record<string, string> = { htm: 'text/html', html: 'text/html', jpg: 'image/jpeg' };

/** Upload ONE file with a firm through the Open a document dialog and wait for the checks stage. */
export async function uploadOne(
  page: Page,
  file: UploadFile,
  tag: { firm: string; fund: string; version?: string },
) {
  if (!(await page.getByTestId('open-document-dialog').isVisible())) await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({
    name: file.name,
    mimeType: file.mimeType ?? MIME[file.name.split('.').pop() ?? ''] ?? 'text/html',
    buffer: file.buffer,
  });
  await page.getByTestId('firm-combobox').fill(tag.firm);
  await page.getByTestId('fund-input').fill(tag.fund);
  if (tag.version !== undefined) await page.getByTestId('version-input').fill(tag.version);
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden({ timeout: 30_000 });
  await waitForChecks(page);
}

/** Wait until the variance pass of the open document settled (no pending display). */
export async function varianceSettled(page: Page) {
  await expect(page.getByTestId('gate-button')).toHaveAttribute('data-variance-pending', 'false', {
    timeout: 30_000,
  });
}

export const changeRows = (page: Page) =>
  page.locator('[data-testid="finding-row"][data-kind="change"]');
export const errorRows = (page: Page) =>
  page.locator('[data-testid="finding-row"]:not([data-kind="change"])');

/** E2E seam (C1b): delay the next variance passes by `ms` (0 = off). */
export async function varianceDelay(page: Page, ms: number) {
  await page.evaluate(
    (n) =>
      (
        window as unknown as { __aduinE2E: { varianceDelayMs: (m: number) => void } }
      ).__aduinE2E.varianceDelayMs(n),
    ms,
  );
}

/** E2E seam (C1b): make the variance passes fail. */
export async function varianceFail(page: Page, on: boolean) {
  await page.evaluate(
    (v) =>
      (
        window as unknown as { __aduinE2E: { varianceFail: (b: boolean) => void } }
      ).__aduinE2E.varianceFail(v),
    on,
  );
}

/** Age every stored upload whose name matches past the 24 h retention (expired baseline case). */
export async function ageUploads(page: Page, name: string) {
  await page.evaluate(
    (n) =>
      new Promise<void>((done, fail) => {
        const req = indexedDB.open('aduin-web');
        req.onerror = () => fail(new Error('idb'));
        req.onsuccess = () => {
          const tx = req.result.transaction(['documents'], 'readwrite');
          const store = tx.objectStore('documents');
          const cur = store.openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return;
            const v = c.value as { name: string; createdAt: number };
            if (v.name === n) c.update({ ...v, createdAt: Date.now() - 25 * 60 * 60 * 1000 });
            c.continue();
          };
          tx.oncomplete = () => done();
        };
      }),
    name,
  );
}
