import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { confirmAllRows, openDemoPackage, runPackage, waitForChecks } from './fixtures/package';

// Intake Phase 2 H9: every demo package listed in the generated packages.json opens, design
// packages first, and reaches findings.
const LIST = resolve(import.meta.dirname, '..', 'public', 'samples', 'packages.json');
const ids = (JSON.parse(readFileSync(LIST, 'utf8')) as { packages: { id: string }[] }).packages.map(
  (p) => p.id,
);
const DESIGN = ['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'];

/** Make the draft runnable: confirm rows; keep one to-digitize sub agreement, others baseline. */
async function makeRunnable(page: Page) {
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  const n = await rows.count();
  let primary = false;
  for (let i = 0; i < n; i++) {
    const role = rows.nth(i).getByTestId('package-row-role');
    if ((await role.inputValue()) !== 'to_digitize') continue;
    if (primary) await role.selectOption('baseline');
    primary = true;
  }
  if (!primary) {
    const first = rows.first();
    await first.getByTestId('package-row-type').selectOption('sub_agreement');
    await first.getByTestId('package-row-role').selectOption('to_digitize');
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
}

test.describe('intake-demo-packages', () => {
  test('should open every listed demo package with design packages first', async ({ page }) => {
    test.setTimeout(240_000);
    expect(ids.length).toBeGreaterThan(0);
    await gotoApp(page);
    await openDialog(page);
    const listed = await page
      .getByTestId('package-sample-option')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-package-id')));
    expect(listed).toEqual(ids);
    const present = DESIGN.filter((d) => ids.includes(d));
    expect(ids.slice(0, present.length)).toEqual(present);
    for (const id of ids) {
      await openDemoPackage(page, id);
      const table = page.getByTestId('package-confirm-table');
      // under full-suite load the draft table can take longer than the 5 s default to mount
      await expect(table.or(page.getByTestId('open-document-dialog')).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect
        .poll(
          async () =>
            (await page.getByTestId('package-row').count()) > 0 ||
            !(await page.getByTestId('open-document-dialog').isVisible()),
          { timeout: 60_000 },
        )
        .toBe(true);
      if (await table.isVisible()) {
        await makeRunnable(page);
        await runPackage(page);
      } else {
        await waitForChecks(page);
      }
      await expect(page.getByTestId('stage-status-button'), id).toContainText('Checks done');
    }
  });
});
