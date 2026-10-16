import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample, row } from './fixtures/app';
import { engineFindings } from './fixtures/seedMemory';

async function selectAndCheck(page: Page, id: string, text: string | RegExp) {
  await row(page, id).click();
  await expect(row(page, id)).toHaveAttribute('aria-expanded', 'true');
  const mark = page.locator(`[data-testid="doc-highlight"][data-finding-id="${id}"]`).first();
  await expect(mark).toHaveClass(/\bon\b/);
  await expect(mark).toBeInViewport();
  const all = await page
    .locator(`[data-testid="doc-highlight"][data-finding-id="${id}"]`)
    .allTextContents();
  expect(all.join('')).toMatch(text);
}

test.describe('finding-highlight', () => {
  test('should highlight the quote of the selected finding (#1 "this Section 11")', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '01');
    const f = engineFindings('01').find((x) => x.detail.facts.reference === 'this Section 11');
    expect(f, 'engine finds the this Section 11 mismatch').toBeTruthy();
    await selectAndCheck(page, f!.id, /this Section 11/);
    await expect(page.getByTestId('finding-found')).toHaveText('this Section 11');
  });

  test('#3 swapped Part B references are highlighted', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    // Phase 02 (E9): only the golden swapped-reference findings carry facts.reference
    for (const f of engineFindings('03').filter((x) => x.detector_id === 'ref-label-coherence'))
      await selectAndCheck(page, f.id, String(f.detail.facts.reference));
  });

  test('#11 undefined "Units" is highlighted', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '11');
    const f = engineFindings('11').find(
      (x) => x.detector_id === 'undefined-term' && x.detail.facts.used_term === 'Units',
    )!;
    await selectAndCheck(page, f.id, /Units/);
  });

  test('clicking a highlight in the document selects its finding', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    const f = engineFindings('03').filter((x) => x.detector_id === 'ref-label-coherence')[1]!;
    await page.locator(`[data-testid="doc-highlight"][data-finding-id="${f.id}"]`).first().click();
    await expect(row(page, f.id)).toHaveAttribute('aria-expanded', 'true');
  });
});
