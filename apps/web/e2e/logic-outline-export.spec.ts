import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeHtml,
  buildStructureView,
  OutlineSchema,
  runDeterministic,
  type StructureView,
} from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';

/**
 * logic-outline-export (AC63): the Structure header exports a JSON form logic outline. Expected
 * counts come from the core structure view computed in Node on the same sample (never hard-coded).
 */
const RAW = resolve(import.meta.dirname, '..', '..', '..', 'samples', 'sub-docs', 'raw');
function engineView(sampleId: string): StructureView {
  const file = readdirSync(RAW).find((f) => f.startsWith(`${sampleId}-`) && f.endsWith('.htm'))!;
  const g = analyzeHtml(readFileSync(resolve(RAW, file)));
  return buildStructureView(g, runDeterministic(g));
}

type Hook = {
  __aduinE2E: { failStage: (s: string) => void; forceInvalidOutline: (on: boolean) => void };
};

async function openStructure(page: Page, id: string) {
  await openSample(page, id);
  await page.getByTestId('nav-structure').click();
  await expect(page.getByTestId('structure-view')).toBeVisible();
}

test.describe('logic-outline-export', () => {
  test('should download a valid outline whose counts match the structure view', async ({
    page,
  }) => {
    const v = engineView('03');
    const expected = {
      sections: v.totals.sections,
      references: v.referenceCount,
      branches: v.totals.conditions,
      definedTerms: v.totals.terms,
      investorPaths: v.investors.types.length,
    };
    expect(expected.branches).toBeGreaterThan(0);
    expect(expected.investorPaths).toBeGreaterThan(0);
    await gotoApp(page);
    await openStructure(page, '03');
    // on-screen counts (preview) equal the Node-derived totals
    const preview = page.getByTestId('outline-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(`${expected.sections} sections incl. parts`);
    for (const [k, n] of Object.entries(expected))
      await expect(page.getByTestId(`outline-preview-${k}`)).toHaveAttribute(
        'data-count',
        String(n),
      );
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('outline-export').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^[A-Za-z0-9._-]+\.logic-outline\.json$/);
    const path = await download.path();
    const text = readFileSync(path, 'utf8');
    const parsed = OutlineSchema.safeParse(JSON.parse(text));
    expect(parsed.success).toBe(true);
    const o = parsed.success ? parsed.data : null;
    expect(o!.disclaimer).toBe('Reference outline only; not a generated form.');
    expect(o!.counts).toEqual(expected);
    expect(o!.sections).toHaveLength(expected.sections);
    expect(o!.references).toHaveLength(expected.references);
    expect(text).toBe(JSON.stringify(o, null, 2));
    await expect(page.getByTestId('outline-export-error')).toHaveCount(0);
  });

  test('blocks the download when the outline fails validation', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as Hook).__aduinE2E.forceInvalidOutline(true));
    await openStructure(page, '01');
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.getByTestId('outline-export').click();
    await expect(page.getByTestId('outline-export-error')).toBeVisible();
    await expect(page.getByTestId('outline-export-error')).toContainText('nothing was downloaded');
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);
  });

  test('disables the export when the document has no structure', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => (window as unknown as Hook).__aduinE2E.failStage('structure'));
    await openSample(page, '01');
    await expect(page.getByTestId('stage-status-button')).toHaveText(/Structuring failed/);
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-meta')).toHaveText('No structure for this document');
    await expect(page.getByTestId('outline-export')).toBeDisabled();
    await expect(page.getByTestId('outline-export-disabled-reason')).toBeVisible();
    await expect(page.getByTestId('outline-preview')).toHaveCount(0);
  });
});
