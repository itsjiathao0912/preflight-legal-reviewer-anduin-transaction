import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFiles,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 3 track 3a (AC-I8): corrections made in the Package lens (Fund II role, LPA type)
// are stored with the package and survive a reload plus restore from Recent packages.
const docRow = (page: Page, name: string) =>
  page.getByTestId('package-lens-doc').filter({ hasText: name });
const unitsTerm = (page: Page) =>
  page.getByTestId('package-term').filter({ has: page.locator('strong', { hasText: /^Units$/ }) });

const unitsDefined = (page: Page) =>
  page.locator('[data-testid="package-term"][data-status="defined_in_package"]', {
    has: page.locator('strong', { hasText: /^Units$/ }),
  });
const unitsFinding = (page: Page) =>
  page.getByTestId('finding-title').filter({ hasText: '"Units" is used for the offered security' });

async function openLens(page: Page) {
  await page.getByTestId('nav-structure').click();
  await page.getByTestId('structure-lens-terms').click();
  await expect(page.getByTestId('package-lens')).toBeVisible();
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
    // E5: read the current role and pick a different one
    const role = docRow(page, 'fund-ii-subscription-agreement-prior').getByTestId(
      'package-lens-doc-role',
    );
    const next = (await role.inputValue()) === 'baseline' ? 'reference' : 'baseline';
    await role.selectOption(next);
    await expect(role).toHaveValue(next);
    // move the LPA away from type lpa: Units is no longer defined in the package
    await expect(unitsTerm(page)).toHaveAttribute('data-status', 'defined_in_package');
    const type = docRow(page, 'northgate-lpa-definitions').getByTestId('package-lens-doc-type');
    await type.selectOption('other');
    await expect(type).toHaveValue('other');
    await expect(unitsDefined(page)).toHaveCount(0);
    const line = (await page.getByTestId('package-lens-line').textContent()) ?? '';
    expect(line).toMatch(/^Coverage: /);

    // the dependent check follows: Units is flagged again in Findings
    await page.getByTestId('nav-findings').click();
    await expect(unitsFinding(page)).toHaveCount(1);

    await page.reload();
    await waitForChecks(page);
    await openDialog(page);
    const recent = page.getByTestId('package-recent-option').first();
    await expect(recent).toBeVisible();
    await recent.click();
    await waitForChecks(page);
    await openLens(page);
    await expect(
      docRow(page, 'fund-ii-subscription-agreement-prior').getByTestId('package-lens-doc-role'),
    ).toHaveValue(next);
    await expect(
      docRow(page, 'northgate-lpa-definitions').getByTestId('package-lens-doc-type'),
    ).toHaveValue('other');
    await expect(unitsDefined(page)).toHaveCount(0);
    await expect(page.getByTestId('package-lens-line')).toHaveText(line);
    await page.getByTestId('nav-findings').click();
    await expect(unitsFinding(page)).toHaveCount(1);
  });
});
