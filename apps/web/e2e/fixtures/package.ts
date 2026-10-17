import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { openDialog } from './app';

/**
 * Intake Phase 2: FROZEN Playwright helpers (read-only for Phase 3). Fixture files come from
 * `fixtures/package/hartwell/` and `samples/sub-docs/raw/`.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
export const HARTWELL_DIR = join(ROOT, 'fixtures', 'package', 'hartwell');
export const RAW_DIR = join(ROOT, 'samples', 'sub-docs', 'raw');

export interface UploadFile {
  name: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface PackageTagInput {
  /** Firm name or alias, or "Other / no firm". */
  firm: string;
  fund: string;
  /** Empty or absent: the version stays empty (required in the confirmation table for N >= 2). */
  version?: string;
}

const MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};
const mimeOf = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'text/html';

export function hartwellFile(name: string): UploadFile {
  return { name, buffer: readFileSync(join(HARTWELL_DIR, name)) };
}

/** The three Hartwell files (Fund III sub agreement, Northgate LPA definitions, Fund II prior). */
export function hartwellFiles(): UploadFile[] {
  return [
    'fund-iii-subscription-agreement.html',
    'northgate-lpa-definitions.docx',
    'fund-ii-subscription-agreement-prior.html',
  ].map(hartwellFile);
}

/** Wait until the checks stage settled and the loading state is gone (60 s: package runs under load). */
export async function waitForChecks(page: Page) {
  await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done|failed/, {
    timeout: 60_000,
  });
  await expect(page.getByTestId('loading-state')).toHaveCount(0, { timeout: 60_000 });
}

/** Open the Upload modal, drop the files at once with the tag and submit (no wait for findings). */
export async function uploadPackage(page: Page, files: UploadFile[], tag: PackageTagInput) {
  if (!(await page.getByTestId('open-document-dialog').isVisible())) await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles(
    files.map((f) => ({
      name: f.name,
      mimeType: f.mimeType ?? mimeOf(f.name),
      buffer: f.buffer,
    })),
  );
  await page.getByTestId('firm-combobox').fill(tag.firm);
  await page.getByTestId('fund-input').fill(tag.fund);
  await page.getByTestId('version-input').fill(tag.version ?? '');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
}

/** Open a demo package from the Demo packages list (confirmation table or auto-run follows). */
export async function openDemoPackage(page: Page, id: string) {
  if (!(await page.getByTestId('open-document-dialog').isVisible())) await openDialog(page);
  await page.locator(`[data-testid="package-sample-option"][data-package-id="${id}"]`).click();
}

/** Confirm every unconfirmed row of the confirmation table. */
export async function confirmAllRows(page: Page) {
  await expect(page.getByTestId('package-confirm-table')).toBeVisible();
  await expect(page.getByTestId('package-row').first()).toBeVisible();
  const boxes = page.getByTestId('package-row-confirm');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) {
    const b = boxes.nth(i);
    if (!(await b.isChecked())) await b.check();
  }
}

/** Click Run checks and wait for findings. */
export async function runPackage(page: Page) {
  await expect(page.getByTestId('package-run')).toBeEnabled();
  await page.getByTestId('package-run').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
  await waitForChecks(page);
}

/** Restore a stored package from the Recent packages list and wait for findings. */
export async function restoreRecentPackage(page: Page, id: string) {
  if (!(await page.getByTestId('open-document-dialog').isVisible())) await openDialog(page);
  await page.locator(`[data-testid="package-recent-option"][data-package-id="${id}"]`).click();
  await waitForChecks(page);
}

/** Row counts of the app's IndexedDB tables (empty object when the database does not exist). */
export async function idbCounts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((done) => {
        const req = indexedDB.open('aduin-web');
        req.onerror = () => done({});
        req.onsuccess = () => {
          const db = req.result;
          const names = [...db.objectStoreNames];
          if (!names.length) return done({});
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, number> = {};
          let left = names.length;
          for (const n of names) {
            const c = tx.objectStore(n).count();
            c.onsuccess = () => {
              out[n] = c.result;
              if (--left === 0) done(out);
            };
          }
        };
      }),
  );
}
