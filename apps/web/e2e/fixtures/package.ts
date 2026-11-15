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
  const option = page.locator(`[data-testid="package-sample-option"][data-package-id="${id}"]`);
  // The demo list starts collapsed: expand it when the option is not shown yet.
  if (!(await option.isVisible())) await page.getByTestId('demo-toggle').click();
  await option.click();
}

/** Confirm every unconfirmed row of the confirmation table. */
export async function confirmAllRows(page: Page) {
  await expect(page.getByTestId('package-confirm-table')).toBeVisible();
  await expect(page.getByTestId('package-row').first()).toBeVisible();
  // "Looks right" is a button shown only on low-confidence rows not yet confirmed; it disappears
  // once pressed, so press the first one until none is left.
  const buttons = page.getByTestId('package-row-confirm');
  for (let n = await buttons.count(); n > 0; n--) {
    await buttons.first().click();
    await expect(buttons).toHaveCount(n - 1);
  }
}

/** Open the Documents screen, where the open package's file list lives. */
export async function openPackageFiles(page: Page) {
  await page.getByTestId('nav-documents').click();
  await expect(page.getByTestId('package-summary')).toBeVisible();
}

/**
 * The package coverage line now lives in the gate popover (the Findings header line is gone).
 * Opens the popover when it is closed; the caller closes it with Escape when it matters.
 */
export async function coverageLine(page: Page) {
  if (!(await page.getByTestId('gate-popover').isVisible()))
    await page.getByTestId('gate-button').click();
  await expect(page.getByTestId('gate-popover')).toBeVisible();
  return page.getByTestId('gate-coverage-line');
}

/**
 * Open bundled sample #5 as a real bundled sample (`source: 'sample'`, no precomputed AI review):
 * the demo package "PG NGI 2024 + 2026" is the only way to reach it since 0c3a6a2. Sample #5 is the
 * document to digitize, #6 a plain reference. Specs that need the "Run AI on this sample" step use
 * this; plain uploads of the same bytes go through the AI lane automatically instead.
 */
export async function openBundledSample5(page: Page) {
  await openDemoPackage(page, 'ngi');
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    const text = (await row.textContent()) ?? '';
    const role = row.getByTestId('package-row-role');
    if (text.includes('05-partners-group-ngi-2024')) {
      await row.getByTestId('package-row-type').selectOption('sub_agreement');
      await role.selectOption('to_digitize');
    } else if (['to_digitize', 'baseline'].includes(await role.inputValue())) {
      await role.selectOption('reference');
    }
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await runPackage(page);
}

/** Click Run checks and wait for findings. */
export async function runPackage(page: Page) {
  await expect(page.getByTestId('package-run')).toBeEnabled();
  await page.getByTestId('package-run').click();
  await expect(page.getByTestId('open-document-dialog')).toBeHidden();
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
