import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, buildStructureView, runDeterministic, type StructureView } from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, openSample } from './fixtures/app';

/**
 * investor-path-view (AC61 / AC62): Investor types lens: type list, ordered path, Partnership or LLC
 * pre-selected, inline gap row (via an uploaded seeded fixture), empty state. Expected values come
 * from the core view model computed in Node.
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

async function openInvestors(page: Page) {
  await page.getByTestId('nav-structure').click();
  await page.getByTestId('structure-lens-investors').click();
}

test.describe('investor-path-view', () => {
  test('should list the Investor types sub-view per type with the gap row', async ({ page }) => {
    const v = viewOf(readFileSync(PEER, 'utf8'));
    const pship = v.investors.types.find((t) => t.type === 'partnership')!;
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
    await openInvestors(page);
    await expect(page.getByTestId('investor-type-row')).toHaveCount(v.investors.types.length);
    // Partnership or LLC is pre-selected (app.html rule)
    const selected = page.locator('[data-testid="investor-type-row"][aria-pressed="true"]');
    await expect(selected).toHaveAttribute('data-type', 'partnership');
    await expect(selected).toContainText('Partnership or LLC');
    await expect(selected).toContainText('1 gap');
    // the inline gap row cites PATH-04 and the peers that carry footnote 2
    const gap = page.getByTestId('investor-gap-row');
    await expect(gap).toHaveCount(pship.gaps.length);
    await expect(gap).toContainText('Footnote 2 is missing here');
    await expect(gap).toContainText('Trust, Corporation, Other entity have it.');
    await expect(gap).toContainText('Rule PATH-04');
    await gap.click();
    await expect(page.getByTestId('structure-drawer')).toContainText(
      'Question for Partnership or LLC',
    );
    // the investors lens issue count equals the computed gap total
    await expect(page.getByTestId('structure-issue-count-investors')).toHaveText(
      new RegExp(`^${v.counts.investors}\\b`),
    );
  });

  test('type list and the ordered path through the document (#3), deterministic', async ({
    page,
  }) => {
    const v = sampleView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await openInvestors(page);
    await expect(page.getByTestId('investor-type-row')).toHaveCount(v.investors.types.length);
    await expect(
      page.locator('[data-testid="investor-type-row"][aria-pressed="true"]'),
    ).toHaveAttribute('data-type', v.investors.preselected!);
    for (const t of v.investors.types.slice(0, 3)) {
      await page.locator(`[data-testid="investor-type-row"][data-type="${t.type}"]`).click();
      const steps = page.getByTestId('investor-path-step');
      await expect(steps).toHaveCount(t.sections.length);
      expect(
        await steps.evaluateAll((els) => els.map((e) => e.getAttribute('data-section'))),
      ).toEqual(t.sections.map((s) => s.number));
    }
  });

  test('a form without investor types shows the empty state', async ({ page }) => {
    const v = sampleView('07');
    expect(v.investors.types).toHaveLength(0);
    await gotoApp(page);
    await openSample(page, '07');
    await openInvestors(page);
    await expect(page.getByTestId('investor-empty-state')).toHaveText(
      'No investor types detected in this document.',
    );
    await expect(page.getByTestId('investor-type-row')).toHaveCount(0);
  });
});
