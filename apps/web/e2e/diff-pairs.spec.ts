import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';
import { chip, chipN, fixture, openCompare, pickPair, upload, waitDiff } from './fixtures/compare';

const V5 = 'PG NGI 2024';
const V6 = 'PG NGI 2026';
const SEEDED = '990000017';

/** No run of 4+ raw digits of the seeded number, once mask tokens ("#0017") are removed. */
function leaks(text: string, n: string): string[] {
  const t = text.replace(/#\d{4}/g, '');
  const out: string[] = [];
  for (let i = 0; i + 4 <= n.length; i++)
    if (t.includes(n.slice(i, i + 4))) out.push(n.slice(i, i + 4));
  return out;
}

function diffMs(page: Page): number[] {
  const ms: number[] = [];
  page.on('console', (m) => {
    const x = m.text().match(/^diff-ms (\d+)$/);
    if (x) ms.push(Number(x[1]));
  });
  return ms;
}

test.describe('diff-pairs', () => {
  test('should show the empty state, then loading, and default to Versions (D-6)', async ({
    page,
  }) => {
    await gotoApp(page);
    await openCompare(page);
    await expect(page.getByTestId('cmp-empty')).toBeVisible();
    await expect(page.getByTestId('cmp-mode-version')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('cmp-mode-sibling')).toHaveAttribute('aria-pressed', 'false');
    const sawLoading = page
      .getByTestId('cmp-loading')
      .waitFor({ state: 'attached', timeout: 30_000 })
      .then(() => true);
    await pickPair(page, V5, V6);
    expect(await sawLoading).toBe(true);
    await waitDiff(page);
    await expect(page.getByTestId('cmp-mode-version')).toHaveAttribute('aria-pressed', 'true');
  });

  test('should reverse added and removed when the pair is swapped; diff-ms under 3 s', async ({
    page,
  }) => {
    const ms = diffMs(page);
    await gotoApp(page);
    await openCompare(page);
    await pickPair(page, V5, V6);
    await waitDiff(page);
    // section-level added / removed exchange on swap (term-level rows are rename-aware, so the
    // inverse direction may infer a different set of definition / requirement changes)
    const secs = async (kind: string) =>
      page.locator(`[data-testid="cmp-item"][data-group="sections"][data-kind="${kind}"]`).count();
    const added = await secs('added');
    const removed = await secs('removed');
    expect(removed).toBeGreaterThan(0); // Appendix C
    await expect(
      page.locator('[data-testid="cmp-item"][data-group="sections"][data-kind="removed"]'),
    ).toContainText([/appendix c/i]);
    await expect(page.locator('[data-testid="cmp-item"][data-group="renames"]')).toContainText([
      'Units to Shares',
    ]);
    await expect.poll(() => ms.length).toBeGreaterThan(0);
    const first = ms[0]!;
    console.log(`[AC29] diff-ms #5 vs #6 = ${first}`);
    expect(first).toBeLessThan(3000);
    await page.getByTestId('cmp-swap').click();
    await expect.poll(() => ms.length).toBeGreaterThan(1);
    await waitDiff(page);
    await expect.poll(() => secs('added')).toBe(removed);
    expect(await secs('removed')).toBe(added);
    await expect(
      page.locator('[data-testid="cmp-item"][data-group="sections"][data-kind="added"]'),
    ).toContainText([/appendix c/i]);
    await expect(page.getByTestId('cmp-base')).toHaveValue('s:06');
  });

  test('should toggle Versions | Siblings and swap the chip groups', async ({ page }) => {
    await gotoApp(page);
    await openCompare(page);
    await pickPair(page, V5, V6);
    await waitDiff(page);
    await expect(chip(page, 'removed')).toBeVisible();
    await page.getByTestId('cmp-mode-sibling').click();
    await expect(page.getByTestId('compare-view')).toHaveAttribute('data-mode', 'sibling');
    await waitDiff(page);
    await expect(chip(page, 'common')).toBeVisible();
    await expect(chip(page, 'differing')).toBeVisible();
    await expect(chip(page, 'removed')).toHaveCount(0);
    await page.getByTestId('cmp-mode-version').click();
    await waitDiff(page);
    await expect(chip(page, 'removed')).toBeVisible();
  });

  test('should show no differences for the same document picked twice', async ({ page }) => {
    await gotoApp(page);
    await openCompare(page);
    await pickPair(page, V5, V5);
    await expect(page.getByTestId('cmp-nodiff')).toContainText('No differences');
    await expect(page.getByTestId('cmp-item')).toHaveCount(0);
  });

  test('should say no differences for an identical pair (two uploads)', async ({ page }) => {
    await gotoApp(page);
    await upload(page, 'ident-a.html', fixture('identical-pair/a.html'));
    await upload(page, 'ident-b.html', fixture('identical-pair/b.html'));
    await openCompare(page);
    await pickPair(page, 'ident-a.html (upload)', 'ident-b.html (upload)');
    await waitDiff(page);
    await expect(page.getByTestId('cmp-nodiff')).toBeVisible();
  });

  test('should not crash on samples 3 and 4 and list added and removed sections', async ({
    page,
  }) => {
    await gotoApp(page);
    await openCompare(page);
    await pickPair(page, 'PG Master Fund 2019', 'PG TEI 2016');
    await waitDiff(page);
    expect(await chipN(page, 'added')).toBeGreaterThan(0);
    expect(await chipN(page, 'removed')).toBeGreaterThan(0);
    await chip(page, 'removed').click();
    const kinds = await page
      .getByTestId('cmp-item')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
    expect(new Set(kinds)).toEqual(new Set(['removed']));
  });

  test('J/K move through the change list and Esc clears the filter then the selection', async ({
    page,
  }) => {
    await gotoApp(page);
    await openCompare(page);
    await pickPair(page, V5, V6);
    await waitDiff(page);
    const items = page.getByTestId('cmp-item');
    await page.locator('#h-compare').focus();
    await page.keyboard.press('j');
    await expect(items.nth(0)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('j');
    await expect(items.nth(1)).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('k');
    await expect(items.nth(0)).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('cmp-detail')).toContainText('Needs counsel');
    await chip(page, 'changed').click();
    await expect(chip(page, 'changed')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#h-compare').focus();
    await page.keyboard.press('Escape');
    await expect(chip(page, 'changed')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="cmp-item"][aria-current="true"]')).toHaveCount(0);
  });

  test('should not leak sensitive digits in masked diff text', async ({ page }) => {
    await gotoApp(page);
    await upload(page, 'sibling-A.html', fixture('sibling-A.html'));
    await upload(page, 'sibling-B.html', fixture('sibling-B.html'));
    await openCompare(page);
    await pickPair(page, 'sibling-A.html (upload)', 'sibling-B.html (upload)');
    await waitDiff(page);
    const view = page.getByTestId('compare-view');
    const acct = page
      .locator('[data-testid="cmp-item"][data-group="sections"]')
      .filter({ hasText: 'WIRE INSTRUCTIONS' });
    await expect(acct).toHaveCount(1);
    await acct.click();
    await expect(page.getByTestId('cmp-clause-diff')).toContainText('#0017');
    expect(leaks(await view.innerText(), SEEDED)).toEqual([]);
    expect(leaks(await view.innerText(), '990000025')).toEqual([]);
    await page.getByTestId('cmp-reveal').click();
    await expect(page.getByTestId('cmp-clause-diff')).toContainText(SEEDED);
    await expect(page.getByTestId('cmp-clause-diff')).toContainText('990000025');
    await page.getByTestId('cmp-reveal').click();
    expect(leaks(await view.innerText(), SEEDED)).toEqual([]);
  });

  test('should show a could-not-read state naming the side for a deeply nested upload', async ({
    page,
  }) => {
    await gotoApp(page);
    // E21: open-element depth beyond MAX_PARSE_DEPTH (16384) -> CoreError payload_too_large at read
    const nested = Buffer.from(`<html><body>${'<div>a'.repeat(17000)}</body></html>`);
    await upload(page, 'nested.html', nested, /failed/);
    await openCompare(page);
    await pickPair(page, 'nested.html (upload)', V5);
    const err = page.getByTestId('cmp-error');
    await expect(err).toBeVisible({ timeout: 30_000 });
    await expect(err).toHaveAttribute('data-side', 'a');
    await expect(err).toContainText('Could not read this document');
    await expect(err).toContainText('A (base)');
    await expect(err).toContainText('payload too large');
    await page.getByTestId('cmp-swap').click();
    await expect(err).toHaveAttribute('data-side', 'b');
    await expect(err).toContainText('B (compare)');
  });

  test('should add a findings-delta row to counsel questions via the existing triage', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '06');
    await openCompare(page);
    await pickPair(page, V5, V6);
    await waitDiff(page);
    const counsel = page.getByTestId('cmp-counsel');
    // diff-only row: disabled with the Phase 08 tooltip
    await page.locator('[data-testid="cmp-item"][data-group="renames"]').first().click();
    await expect(counsel).toBeDisabled();
    await expect(counsel).toHaveAttribute('title', 'Available after counsel sheet (Phase 08)');
    // findings-delta row of the open document (#6): enabled, toggles the triage
    await page.locator('[data-testid="cmp-item"][data-kind="still"]').first().click();
    await expect(counsel).toBeEnabled();
    await counsel.click();
    await expect(counsel).toHaveAttribute('aria-pressed', 'true');
    // a fixed row belongs to #5 (not open): disabled
    await page.locator('[data-testid="cmp-item"][data-kind="fixed"]').first().click();
    await expect(counsel).toBeDisabled();
  });
});
