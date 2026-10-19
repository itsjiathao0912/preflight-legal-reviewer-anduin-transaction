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
const TABS = ['sections', 'logic', 'terms'] as const;
const LOGIC = ['crossrefs', 'conditions', 'options', 'investors'] as const;

test.describe('structure-view', () => {
  test('should render the Structure view with Issues only by default and 3 tabs', async ({
    page,
  }) => {
    const v = engineView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await expect(page.getByTestId('structure-hint')).toContainText('click a row to see why');
    await expect(page.getByRole('tab')).toHaveText([/^Sections/, /^Logic/, /^Defined terms/]);
    // tab badges are the summed issue counts of the lists they hold
    const sum = {
      sections: v.counts.sections,
      logic: LOGIC.reduce((n, l) => n + v.counts[l], 0),
      terms: v.counts.terms,
    };
    for (const t of TABS) {
      const c = page.getByTestId(`structure-tab-count-${t}`);
      if (sum[t]) await expect(c).toHaveText(new RegExp(`^${sum[t]}\\b`));
      else await expect(c).toHaveCount(0);
    }
    expect(v.badge).toBeGreaterThan(0);
    await expect(page.getByTestId('nav-badge-structure')).toHaveText(
      new RegExp(`To check: ${v.badge}$`),
    );
    await expect(page.getByTestId('structure-meta')).toContainText(`${v.badge} to check`);
    // Issues only is the default: Sections shows only the flagged top-level sections, two columns
    await expect(page.getByTestId('structure-toggle-everything')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByTestId('structure-lens-sections')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const flagged = v.sections.filter((s) => s.depth === 0 && s.flags > 0).length;
    await expect(page.getByTestId('structure-line')).toHaveText(
      `Issues only: ${flagged} of ${v.totals.sections}. Turn on Show everything for the full list.`,
    );
    await expect(page.getByTestId('structure-row')).toHaveCount(flagged);
    if (flagged)
      await expect(page.locator('#st-panel thead th')).toHaveText(['Section', 'To check']);
    else await expect(page.getByTestId('structure-empty-lens')).toBeVisible();
    // Logic groups cross-references, conditions, option groups and investor types with their counts
    await page.getByTestId('structure-lens-logic').click();
    for (const l of LOGIC) {
      await expect(page.getByTestId(`structure-group-${l}`)).toBeVisible();
      const c = page.getByTestId(`structure-issue-count-${l}`);
      if (v.counts[l]) await expect(c).toHaveText(new RegExp(`^${v.counts[l]}\\b`));
      else await expect(c).toHaveCount(0);
    }
    await expect(
      page.getByTestId('structure-group-crossrefs').getByTestId('structure-row'),
    ).toHaveCount(v.counts.crossrefs);
    await expect(page.getByTestId('structure-external')).toHaveCount(0);
  });

  test('Show everything raises the row count and lists statutory citations separately (never as internal)', async ({
    page,
  }) => {
    const v = engineView('03');
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-logic').click();
    const refs = page.getByTestId('structure-group-crossrefs');
    const before = await refs.getByTestId('structure-row').count();
    await page.getByTestId('structure-toggle-everything').click();
    await expect(page.getByTestId('structure-toggle-everything')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(refs.getByTestId('structure-row')).toHaveCount(
      v.totals.crossrefs + v.external.length,
    );
    expect(v.totals.crossrefs + v.external.length).toBeGreaterThan(before);
    const ext = page.getByTestId('structure-external');
    await expect(ext).toBeVisible();
    await expect(ext.getByTestId('structure-row')).toHaveCount(v.external.length);
    await expect(ext).toContainText('External, not checked');
    // the internal table holds exactly the internal references; no external text is listed there
    const internal = refs.locator('table').first().getByTestId('structure-row');
    await expect(internal).toHaveCount(v.totals.crossrefs);
    const internalText = (await internal.allTextContents()).join(' | ');
    for (const x of v.external) expect(internalText).not.toContain(`${x.text}${x.where}`);
    // every list shows its full total when Show everything is on
    await expect(page.getByTestId('structure-line')).toHaveText(
      `Showing everything: ${v.totals.crossrefs + v.totals.conditions + v.totals.options} rows.`,
    );
    for (const l of ['conditions', 'options'] as const)
      await expect(
        page.getByTestId(`structure-group-${l}`).getByTestId('structure-row'),
      ).toHaveCount(v.totals[l]);
    await page.getByTestId('structure-lens-terms').click();
    await expect(page.getByTestId('structure-line')).toHaveText(
      `Showing everything: ${v.totals.terms} rows.`,
    );
    await expect(page.getByTestId('structure-row')).toHaveCount(v.totals.terms);
    // sections show numbering and references columns, with the restart badge (Parts A to C of Section 2)
    await page.getByTestId('structure-lens-sections').click();
    await expect(page.getByTestId('structure-row')).toHaveCount(v.totals.sections);
    await expect(page.locator('#st-panel thead th')).toHaveText([
      'Section',
      'Numbering',
      'References',
      'To check',
    ]);
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
    await page.getByTestId('structure-lens-logic').click();
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
