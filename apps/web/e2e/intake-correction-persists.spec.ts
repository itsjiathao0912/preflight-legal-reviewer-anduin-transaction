import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openFindingsView } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFiles,
  openPackageFiles,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 3 track 3a (AC-I8): corrections made in the package file list (Documents) (Fund II role, LPA type)
// are stored with the package and survive a reload plus restore from Recent packages.
const docRow = (page: Page, name: string) =>
  page.getByTestId('package-lens-doc').filter({ hasText: name });
const unitsTerm = (page: Page) =>
  page
    .getByTestId('sources-row')
    .filter({ has: page.locator('td:first-child', { hasText: /^Units$/ }) });

// "Units" defined by the package LPA: kind "Term · LPA"
const unitsDefined = (page: Page) => unitsTerm(page).filter({ hasText: 'Term · LPA' });
const unitsFinding = (page: Page) =>
  page.getByTestId('finding-title').filter({ hasText: '"Units" is used for the offered security' });

async function openLens(page: Page) {
  await openFindingsView(page, 'sources');
  await expect(page.getByTestId('sources-row').first()).toBeVisible();
}

test.describe('intake-correction-persists', () => {
  test('should keep lens corrections after reload and restore', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await confirmAllRows(page);
    await runPackage(page);
    await openLens(page);
    await expect(unitsDefined(page)).toHaveCount(1);
    await openPackageFiles(page);
    // E5: read the current role and pick a different one
    const role = docRow(page, 'fund-ii-subscription-agreement-prior').getByTestId(
      'package-lens-doc-role',
    );
    const next = (await role.inputValue()) === 'baseline' ? 'reference' : 'baseline';
    await role.selectOption(next);
    await expect(role).toHaveValue(next);
    // move the LPA away from type lpa: Units is no longer defined in the package
    const type = docRow(page, 'northgate-lpa-definitions').getByTestId('package-lens-doc-type');
    await type.selectOption('other');
    await expect(type).toHaveValue('other');
    await openLens(page);
    await expect(unitsDefined(page)).toHaveCount(0);
    await openPackageFiles(page);
    const line = (await page.getByTestId('package-summary-line').textContent()) ?? '';
    expect(line).toMatch(/^Coverage: /);

    // the dependent check follows: Units is flagged again in Findings
    await openFindingsView(page, 'issues');
    await expect(unitsFinding(page)).toHaveCount(1);

    await page.reload();
    await waitForChecks(page);
    // reopen from Documents (the Recent packages list left the Open dialog)
    await page.getByTestId('nav-documents').click();
    await page.getByTestId('documents-row').first().click();
    await waitForChecks(page);
    await openPackageFiles(page);
    await expect(
      docRow(page, 'fund-ii-subscription-agreement-prior').getByTestId('package-lens-doc-role'),
    ).toHaveValue(next);
    await expect(
      docRow(page, 'northgate-lpa-definitions').getByTestId('package-lens-doc-type'),
    ).toHaveValue('other');
    await openLens(page);
    await expect(unitsDefined(page)).toHaveCount(0);
    await openPackageFiles(page);
    await expect(page.getByTestId('package-summary-line')).toHaveText(line);
    await openFindingsView(page, 'issues');
    await expect(unitsFinding(page)).toHaveCount(1);
  });
});
