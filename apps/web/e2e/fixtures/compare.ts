import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { openDialog } from './app';

/** Seeded Phase 07 fixtures (untrusted input data: read only, delivered through upload-input, E19). */
export const DIFF_DIR = resolve(import.meta.dirname, '..', '..', '..', '..', 'fixtures', 'diff');
export const fixture = (rel: string) => readFileSync(resolve(DIFF_DIR, rel));

/** Upload one file through the Open a document dialog (persisted to IndexedDB before analyze). */
export async function upload(page: Page, name: string, buffer: Buffer, done = /Checks done/) {
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({ name, mimeType: 'text/html', buffer });
  await page.getByTestId('firm-combobox').fill('Other / no firm');
  await page.getByTestId('fund-input').fill('Seeded diff fixture');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('stage-status-button')).toContainText(done, { timeout: 30_000 });
}

export async function openCompare(page: Page) {
  await page.getByTestId('nav-compare').click();
  await expect(page.getByTestId('compare-view')).toBeVisible();
}

export async function pickPair(page: Page, base: string, cmp: string) {
  await page.getByTestId('cmp-base').selectOption({ label: base });
  await page.getByTestId('cmp-compare').selectOption({ label: cmp });
}

export const chip = (page: Page, k: string) =>
  page.locator(`[data-testid="cmp-chip"][data-k="${k}"]`);

export async function chipN(page: Page, k: string): Promise<number> {
  return Number(await chip(page, k).getAttribute('data-n'));
}

/** Wait until a diff result (items or a notice) is on screen. */
export async function waitDiff(page: Page) {
  await expect(
    page
      .locator(
        '[data-testid="cmp-item"], [data-testid="cmp-nodiff"], [data-testid="cmp-nostructure"], [data-testid="cmp-error"]',
      )
      .first(),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('cmp-loading')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId('cmp-error')).toHaveCount(0);
}
