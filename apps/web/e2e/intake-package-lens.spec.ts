import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';
import { confirmAllRows, openDemoPackage, runPackage } from './fixtures/package';

// Intake Phase 3 track 3a (AC-I17 lens half, AC-I9 lens): the Package lens in Structure lists
// documents, references, terms and the five coverage groups; a baseline is markable from the lens.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const expected = JSON.parse(readFileSync(resolve(ROOT, 'fixtures/package/expected.json'), 'utf8'));
const listed = (
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '..', 'public/samples/packages.json'), 'utf8'),
  ) as { packages: { id: string }[] }
).packages.map((p) => p.id);
const GROUPS = [
  'structure_flow',
  'internal_refs',
  'defined_terms',
  'external_refs',
  'investor_paths',
];

type FileSpec = Record<string, { type: string; finalRole: string }>;

/** Open a demo package, set each row to its expected type and role, confirm and run. */
async function openAndRun(page: Page, id: string, files: FileSpec) {
  await openDemoPackage(page, id);
  const rows = page.getByTestId('package-row');
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  for (const [name, f] of Object.entries(files)) {
    const r = rows.filter({ hasText: name });
    await r.getByTestId('package-row-type').selectOption(f.type);
    await r.getByTestId('package-row-role').selectOption(f.finalRole);
  }
  await confirmAllRows(page);
  const version = page.getByTestId('package-version-input');
  if (!(await version.inputValue())) await version.fill('v1');
  await runPackage(page);
}

async function openLens(page: Page) {
  await page.getByTestId('nav-structure').click();
  await page.getByTestId('structure-lens-terms').click();
  await expect(page.getByTestId('package-lens')).toBeVisible();
}

test.describe('intake-package-lens', () => {
  test('should show documents, references, terms and coverage for Hartwell', async ({ page }) => {
    test.setTimeout(120_000);
    const hw = expected.hartwell;
    await gotoApp(page);
    await openAndRun(page, 'hartwell', hw.files);
    await openLens(page);
    const lens = page.getByTestId('package-lens');
    await expect(lens.getByTestId('package-lens-doc')).toHaveCount(Object.keys(hw.files).length);
    // references: LPA resolved, the other three families not in the package
    await expect(
      lens.locator('[data-testid="package-reference"][data-target-key="lpa"]').first(),
    ).toHaveAttribute('data-resolution', 'resolved');
    for (const key of ['annex:annex f', 'side_letter', 'tax_form:form w-8ben-e']) {
      const r = lens.locator(`[data-testid="package-reference"][data-target-key="${key}"]`);
      await expect(r.first()).toHaveAttribute('data-resolution', 'not_in_package');
      await expect(r.first()).toContainText('Not in package');
      await expect(r.first()).toContainText(/, paragraph \d+/);
    }
    await expect(lens.getByTestId('package-term').first()).toBeVisible();
    const groups = lens.getByTestId('package-coverage-group');
    await expect(groups).toHaveCount(5);
    expect(await groups.evaluateAll((e) => e.map((x) => x.getAttribute('data-group')))).toEqual(
      GROUPS,
    );
    await expect(page.getByTestId('package-lens-line')).toHaveText(hw.coverageLine);
    // AC-I9 lens: Fund II (same firm, sub agreement) can be marked baseline from the lens
    const fund2 = lens
      .getByTestId('package-lens-doc')
      .filter({ hasText: 'fund-ii-subscription-agreement-prior' });
    const role = fund2.getByTestId('package-lens-doc-role');
    if ((await role.inputValue()) === 'baseline') {
      await role.selectOption('reference');
      await expect(role).toHaveValue('reference');
    }
    await role.selectOption('baseline');
    await expect(role).toHaveValue('baseline');
    await expect(page.getByTestId('package-lens-action-error')).toHaveCount(0);
    // the LPA is not a sub agreement: Baseline is disabled for it
    const lpaRole = lens
      .getByTestId('package-lens-doc')
      .filter({ hasText: 'northgate-lpa-definitions' })
      .getByTestId('package-lens-doc-role');
    await expect(lpaRole.locator('option[value="baseline"]')).toBeDisabled();
  });

  test('should show no Package tab for sample #3 opened from Samples', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '03');
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await expect(page.getByTestId('structure-lens-terms')).toHaveText(/^Defined terms/);
    await page.getByTestId('structure-lens-terms').click();
    await expect(page.getByTestId('structure-group-package')).toHaveCount(0);
  });

  test('should show the Northgate III baseline and references from expected.json', async ({
    page,
  }) => {
    test.skip(!listed.includes('northgate-iii'), 'northgate-iii not listed in packages.json');
    test.setTimeout(180_000);
    const ng = expected.design['northgate-iii'];
    await gotoApp(page);
    await openAndRun(page, 'northgate-iii', ng.files);
    await openLens(page);
    const lens = page.getByTestId('package-lens');
    const baseline = Object.entries(ng.files as FileSpec).find(
      ([, f]) => f.finalRole === 'baseline',
    )![0];
    await expect(
      lens
        .getByTestId('package-lens-doc')
        .filter({ hasText: baseline })
        .getByTestId('package-lens-doc-role'),
    ).toHaveValue('baseline');
    for (const fam of ng.resolved as string[])
      await expect(
        lens.locator(`[data-testid="package-reference"][data-target-key="${fam}"]`).first(),
      ).toHaveAttribute('data-resolution', 'resolved');
    for (const key of ng.notInPackage as string[])
      await expect(
        lens.locator(`[data-testid="package-reference"][data-target-key="${key}"]`).first(),
      ).toHaveAttribute('data-resolution', 'not_in_package');
    await expect(lens.getByTestId('package-coverage-group')).toHaveCount(5);
  });
});
