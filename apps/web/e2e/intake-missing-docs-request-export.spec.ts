import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import mammoth from 'mammoth';
import { gotoApp } from './fixtures/app';
import { exportDocxText, gotoCounsel } from './fixtures/counsel';
import {
  confirmAllRows,
  hartwellFiles,
  openDemoPackage,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 3c D1 (AC-I20): the GP group lists one item per missing document with its quote
// and count; one request export holds each of them exactly once. Counsel sheet export unchanged.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const EXPECTED = JSON.parse(
  readFileSync(resolve(ROOT, 'fixtures', 'package', 'expected.json'), 'utf8'),
) as {
  hartwell: { requests: string[] };
  design: Record<string, { requests: string[] }>;
};
const LIST = resolve(import.meta.dirname, '..', 'public', 'samples', 'packages.json');
const listed = (
  JSON.parse(readFileSync(LIST, 'utf8')) as { packages: { id: string }[] }
).packages.map((p) => p.id);

/** Assert the GP group items and the exported request DOCX for the expected labels. */
async function checkGroupAndExport(page: Page, labels: string[]) {
  await gotoCounsel(page);
  const group = page.getByTestId('gp-group');
  await expect(group).toBeVisible();
  const items = group.getByTestId('gp-request-item');
  await expect(items).toHaveCount(labels.length);
  const quotes: string[] = [];
  for (const label of labels) {
    const item = items.filter({ hasText: label }).first();
    await expect(item).toBeVisible();
    await expect(item.getByTestId('gp-request-count')).toHaveText(/referenced \d+ times?/);
    const q = (await item.getByTestId('gp-request-quote').textContent())?.trim() ?? '';
    expect(q.length).toBeGreaterThan(0);
    quotes.push(q);
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('gp-request-export').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^missing-documents-.*\.docx$/);
  const { value } = await mammoth.extractRawText({ buffer: readFileSync(await download.path()) });
  for (const label of labels) {
    const headings = value.split('\n').filter((l) => /^\d+\. /.test(l) && l.endsWith(label));
    expect(headings, label).toHaveLength(1);
  }
  for (const q of quotes) expect(value).toContain(q);
  expect(value).toContain(`${labels.length} document${labels.length === 1 ? '' : 's'} needed`);
}

test.describe('intake-missing-docs-request-export', () => {
  test('should export one request per missing document for Hartwell Fund III', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await confirmAllRows(page);
    await runPackage(page);
    await checkGroupAndExport(page, EXPECTED.hartwell.requests);
    // the counsel query sheet export is unchanged
    const sheet = await exportDocxText(page);
    expect(sheet.filename).toMatch(/^counsel-questions-.*\.docx$/);
    expect(sheet.text).not.toContain('Missing documents request');
  });

  test('should match the answer key for demo northgate-iii', async ({ page }) => {
    test.skip(!listed.includes('northgate-iii'), 'northgate-iii is not listed in packages.json');
    test.setTimeout(180_000);
    await gotoApp(page);
    await openDemoPackage(page, 'northgate-iii');
    const table = page.getByTestId('package-confirm-table');
    await expect(table.or(page.getByTestId('loading-state')).first()).toBeVisible({
      timeout: 60_000,
    });
    if (await table.isVisible()) {
      await confirmAllRows(page);
      const version = page.getByTestId('package-version-input');
      if (!(await version.inputValue())) await version.fill('v1');
      await runPackage(page);
    } else {
      await waitForChecks(page);
    }
    await checkGroupAndExport(page, EXPECTED.design['northgate-iii']!.requests);
  });
});
