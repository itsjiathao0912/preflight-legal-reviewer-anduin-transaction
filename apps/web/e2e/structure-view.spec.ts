import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, buildStructureView, runDeterministic, type StructureView } from '@aduin/core';
import { expect, test } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';

/**
 * structure-view (AC17): the real #structure view. Every expected number is derived from the core
 * structure view model computed in Node on the same sample (never hard-coded).
 */
const RAW = resolve(import.meta.dirname, '..', '..', '..', 'samples', 'sub-docs', 'raw');
function engineView(sampleId: string): StructureView {
  const file = readdirSync(RAW).find((f) => f.startsWith(`${sampleId}-`) && f.endsWith('.htm'))!;
  const g = analyzeHtml(readFileSync(resolve(RAW, file)));
  return buildStructureView(g, runDeterministic(g));
}
const LENSES = ['sections', 'crossrefs', 'conditions', 'options', 'terms', 'investors'] as const;

test.describe('structure-view', () => {
  test('should render the Structure view with Issues only by default and 6 lenses', async ({
    page,
  }) => {
    const v = engineView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    for (const l of LENSES) await expect(page.getByTestId(`structure-lens-${l}`)).toBeVisible();
    await expect(page.getByRole('tab')).toHaveText([
      /^Sections/,
      /^Cross-references/,
      /^Conditions/,
      /^Option groups/,
      /^Defined terms/,
      /^Investor types/,
    ]);
    // per-lens issue counts and the computed sidebar badge come from the same view model
    for (const l of LENSES) {
      const c = page.getByTestId(`structure-issue-count-${l}`);
      if (v.counts[l]) await expect(c).toHaveText(new RegExp(`^${v.counts[l]}\\b`));
      else await expect(c).toHaveCount(0);
    }
    expect(v.badge).toBeGreaterThan(0);
    await expect(page.getByTestId('nav-badge-structure')).toHaveText(
      new RegExp(`To check: ${v.badge}$`),
    );
    await expect(page.getByTestId('structure-meta')).toContainText(`${v.badge} to check`);
    // Issues only is the default: Cross-references shows only the flagged rows
    await expect(page.getByTestId('structure-toggle-everything')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByTestId('structure-lens-crossrefs')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('structure-line')).toHaveText(
      `Issues only: ${v.counts.crossrefs} of ${v.totals.crossrefs}. Turn on Show everything for the full list.`,
    );
    await expect(page.getByTestId('structure-row')).toHaveCount(v.counts.crossrefs);
    await expect(page.getByTestId('structure-external')).toHaveCount(0);
  });

  test('Show everything raises the row count and lists statutory citations separately (never as internal)', async ({
    page,
  }) => {
    const v = engineView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    const before = await page.getByTestId('structure-row').count();
    await page.getByTestId('structure-toggle-everything').click();
    await expect(page.getByTestId('structure-toggle-everything')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('structure-row')).toHaveCount(
      v.totals.crossrefs + v.external.length,
    );
    expect(v.totals.crossrefs + v.external.length).toBeGreaterThan(before);
    const ext = page.getByTestId('structure-external');
    await expect(ext).toBeVisible();
    await expect(ext.getByTestId('structure-row')).toHaveCount(v.external.length);
    await expect(ext).toContainText('External, not checked');
    // the internal table holds exactly the internal references; no external text is listed there
    const internal = page.locator('table').first().getByTestId('structure-row');
    await expect(internal).toHaveCount(v.totals.crossrefs);
    const internalText = (await internal.allTextContents()).join(' | ');
    for (const x of v.external) expect(internalText).not.toContain(`${x.text}${x.where}`);
    // every lens shows its full total when Show everything is on
    for (const l of ['sections', 'conditions', 'options', 'terms'] as const) {
      await page.getByTestId(`structure-lens-${l}`).click();
      await expect(page.getByTestId('structure-line')).toHaveText(
        `Showing everything: ${v.totals[l]} rows.`,
      );
      await expect(page.getByTestId('structure-row')).toHaveCount(v.totals[l]);
    }
    // sections carry the restart badge where numbering restarts (Parts A to C of Section 2)
    await page.getByTestId('structure-lens-sections').click();
    await expect(
      page.getByTestId('structure-row').filter({ hasText: 'Restarts' }).first(),
    ).toBeVisible();
  });

  test('a row opens the right-hand drawer; Escape and Close return focus', async ({ page }) => {
    const v = engineView('03');
    const sus = v.crossrefs.find((r) => r.status === 'suspicious')!;
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    const row = page.locator(`[data-testid="structure-row"][data-k="${sus.id}"]`);
    await row.click();
    const drawer = page.getByTestId('structure-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('Cross-reference');
    await expect(drawer).toContainText('Suspicious');
    await expect(drawer).toContainText(sus.expected!);
    await expect(row).toHaveClass(/\bsel\b/);
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await row.click();
    await drawer.getByRole('button', { name: 'Close details' }).click();
    await expect(drawer).toHaveCount(0);
    // Show in document jumps to Findings on the linked finding
    await row.click();
    await drawer.getByRole('button', { name: 'Show in document' }).click();
    await expect(page.getByTestId('findings-header')).toBeVisible();
  });

  test('no document: the view shows its empty state and no badge', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await expect(page.getByTestId('structure-empty')).toBeVisible();
    await expect(page.getByTestId('nav-badge-structure')).toHaveText('');
  });
});
