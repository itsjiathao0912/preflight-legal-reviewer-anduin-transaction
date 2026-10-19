import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { confirmAllRows, runPackage, waitForChecks } from './fixtures/package';

// Source File traceability smoke (Northgate demo package): a term row names where the LPA
// defines it and opens the LPA in the reading pane with a Back bar; a defined-term finding's
// Details lists the LPA as its Source File.
const LPA_FILE = 'LPA (02-NG3-LPA-Definitions-and-Key-Terms.docx)';

/** Open Northgate and reach findings (one to-digitize sub agreement, others as detected). */
async function openNorthgate(page: Page) {
  await openDialog(page);
  const option = page.locator(
    '[data-testid="package-sample-option"][data-package-id="northgate-iii"]',
  );
  if (!(await option.isVisible())) await page.getByTestId('demo-toggle').click();
  await option.click();
  const table = page.getByTestId('package-confirm-table');
  await expect
    .poll(
      async () =>
        (await page.getByTestId('package-row').count()) > 0 ||
        !(await page.getByTestId('open-document-dialog').isVisible()),
      { timeout: 60_000 },
    )
    .toBe(true);
  if (!(await table.isVisible())) return waitForChecks(page);
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  let primary = false;
  for (let i = 0; i < (await rows.count()); i++) {
    const role = rows.nth(i).getByTestId('package-row-role');
    if ((await role.inputValue()) !== 'to_digitize') continue;
    if (primary) await role.selectOption('baseline');
    primary = true;
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await runPackage(page);
}

test.describe('source-file-smoke', () => {
  test('should trace terms and findings to the LPA and open it read-only', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page);
    await openNorthgate(page);

    // Findings -> the "Units" defined-term finding -> Details -> Source File
    const row = page
      .getByTestId('finding-row')
      .filter({ has: page.getByTestId('finding-title').filter({ hasText: '"Units"' }) })
      .first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();
    const body = page.getByTestId('finding-body');
    await body.getByTestId('finding-details').locator('summary').click();
    const src = body.getByTestId('finding-source-file');
    await expect(src).toContainText(LPA_FILE);
    await src.getByTestId('finding-source-file-open').first().click();
    await expect(page.getByTestId('ref-view-bar')).toContainText('Viewing LPA (reference file)');
    await expect(page.getByTestId('ref-view-paper')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('doc-highlight')).toHaveCount(0);
    await page.getByTestId('ref-view-back').click();
    await expect(page.getByTestId('ref-view-bar')).toHaveCount(0);
    await expect(page.getByTestId('doc-highlight').first()).toBeVisible();

    // Structure -> Terms & package -> a term defined in the LPA shows its location + Open
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-terms').click();
    const term = page
      .getByTestId('package-term')
      .filter({ has: page.locator('strong', { hasText: /^Capital Commitment$/ }) });
    await expect(term.getByTestId('package-term-status')).toContainText(
      /Defined in LPA · Section 1\.1, ¶ \d+/,
    );
    await term.getByTestId('package-term-open').click();
    const bar = page.getByTestId('ref-view-bar');
    await expect(bar).toContainText('Viewing LPA (reference file)');
    await expect(bar.getByTestId('ref-view-back')).toHaveText(/^← Back to /);
    const paper = page.getByTestId('ref-view-paper');
    await expect(paper).toContainText('“Capital Commitment” means');
    await expect(paper.locator('.ref-flash')).toContainText('“Capital Commitment” means');
    await bar.getByTestId('ref-view-back').click();
    await expect(page.getByTestId('ref-view-bar')).toHaveCount(0);
    await expect(page.getByTestId('doc-pane')).not.toHaveAttribute('data-ref-view', /.+/);
  });
});
