import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, buildStructureView, runDeterministic, type StructureView } from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openFindingsView, openSample } from './fixtures/app';

/**
 * investor-path-view (AC61 / AC62): the Form flow view in Findings (the old Investor types lens was
 * folded into it): investor type picker, the path for the chosen type, the break shown inline for
 * a seeded gap, empty state. Expected values come from the core view model computed in Node.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const RAW = resolve(ROOT, 'samples', 'sub-docs', 'raw');
const PEER = resolve(
  ROOT,
  'fixtures',
  'html-seeded',
  'investor-path-missing-item',
  'peer-item.html',
);

function viewOf(bytes: Uint8Array | string): StructureView {
  const g = analyzeHtml(bytes);
  return buildStructureView(g, runDeterministic(g));
}
const sampleView = (id: string) =>
  viewOf(
    readFileSync(
      resolve(
        RAW,
        readdirSync(RAW).find((f) => f.startsWith(`${id}-`) && f.endsWith('.htm'))!,
      ),
    ),
  );

async function openFlow(page: Page) {
  await openFindingsView(page, 'flow');
}

test.describe('investor-path-view', () => {
  test('should list every investor type in the picker and show the seeded gap as a break', async ({
    page,
  }) => {
    const v = viewOf(readFileSync(PEER, 'utf8'));
    await gotoApp(page);
    await openDialog(page);
    await page.getByTestId('upload-input').setInputFiles({
      name: 'peer-item.html',
      mimeType: 'text/html',
      buffer: readFileSync(PEER),
    });
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('Seeded PATH-04 fixture');
    await page.getByTestId('version-input').fill('seeded');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
    await openFlow(page);
    await expect(page.getByTestId('flow-type-summary')).toContainText(
      `of ${v.investors.types.length} reach the signature`,
    );
    await page.getByTestId('flow-type-select').click();
    await expect(page.getByRole('option')).toHaveCount(v.investors.types.length);
    await page.getByTestId('flow-type-partnership').click();
    await expect(page.getByTestId('flow-type-select')).toHaveAttribute('data-value', 'partnership');
    await expect(page.getByTestId('flow-end')).toBeVisible();
  });

  test('type picker and the path through the document (#3), deterministic', async ({ page }) => {
    const v = sampleView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await openFlow(page);
    for (const t of v.investors.types.slice(0, 3)) {
      await page.getByTestId('flow-type-select').click();
      await page.getByTestId(`flow-type-${t.type}`).click();
      await expect(page.getByTestId('flow-type-select')).toHaveAttribute('data-value', t.type);
      await expect(page.getByTestId('flow-end')).toBeVisible();
    }
  });

  test('a form without investor types shows the empty state', async ({ page }) => {
    const v = sampleView('07');
    expect(v.investors.types).toHaveLength(0);
    await gotoApp(page);
    await openSample(page, '07');
    await openFlow(page);
    await expect(
      page.getByText('No investor types detected; showing every section.'),
    ).toBeVisible();
    await expect(page.getByTestId('flow-type-select')).toHaveCount(0);
  });
});
