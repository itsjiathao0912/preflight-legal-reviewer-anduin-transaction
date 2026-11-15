import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openFindingsView } from './fixtures/app';
import { confirmAllRows, openDemoPackage, openPackageFiles, runPackage } from './fixtures/package';
import { uploadOne } from './fixtures/variance';

// Intake Phase 3 track 3a (AC-I17 lens half, AC-I9 lens): the Sources view in Findings lists
// references and terms (the old Package lens and its five coverage groups are gone); the package
// file list (with the baseline control) and the coverage line live on the Documents screen.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const expected = JSON.parse(readFileSync(resolve(ROOT, 'fixtures/package/expected.json'), 'utf8'));
const listed = (
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '..', 'public/samples/packages.json'), 'utf8'),
  ) as { packages: { id: string }[] }
).packages.map((p) => p.id);

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
  await openFindingsView(page, 'sources');
}

const source = (page: Page, key: string) =>
  page.locator(`[data-testid="sources-row"][data-target-key="${key}"]`);

test.describe('intake-package-lens', () => {
  test('should show documents, references, terms and coverage for Hartwell', async ({ page }) => {
    test.setTimeout(120_000);
    const hw = expected.hartwell;
    await gotoApp(page);
    await openAndRun(page, 'hartwell', hw.files);
    await openLens(page);
    // references: LPA found, the other three families missing from the package
    await expect(source(page, 'lpa').first()).toContainText('Found');
    for (const key of ['annex:annex f', 'side_letter', 'tax_form:form w-8ben-e']) {
      await expect(source(page, key).first()).toContainText('Missing');
    }
    await expect(page.getByTestId('sources-row').filter({ hasText: /Term/ }).first()).toBeVisible();
    // the file list and the coverage line live on Documents
    await openPackageFiles(page);
    const files = page.getByTestId('package-summary');
    await expect(files.getByTestId('package-lens-doc')).toHaveCount(Object.keys(hw.files).length);
    await expect(page.getByTestId('package-summary-line')).toHaveText(hw.coverageLine);
    // AC-I9: Fund II (same firm, sub agreement) can be marked baseline from the file list
    const fund2 = files
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
    const lpaRole = files
      .getByTestId('package-lens-doc')
      .filter({ hasText: 'northgate-lpa-definitions' })
      .getByTestId('package-lens-doc-role');
    await expect(lpaRole.locator('option[value="baseline"]')).toBeDisabled();
  });

  test('should show no Package group for a classic (non-package) document', async ({ page }) => {
    await gotoApp(page);
    // The Samples list left the Open a document dialog in 0c3a6a2, and a single sub-agreement
    // upload is a one-document package (by design), so a classic non-sub-doc upload stands in.
    await uploadOne(
      page,
      { name: 'note.html', buffer: Buffer.from('<html><body><p>Cover note.</p></body></html>') },
      { firm: 'Other / no firm', fund: 'Test Fund' },
    );
    await openFindingsView(page, 'sources');
    await expect(page.getByTestId('sources-confirm')).toHaveCount(0);
    await expect(page.getByTestId('sources-open-file')).toHaveCount(0);
    await page.getByTestId('nav-documents').click();
    await expect(page.getByTestId('documents-view')).toBeVisible();
    await expect(page.getByTestId('package-summary')).toHaveCount(0);
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
    const baseline = Object.entries(ng.files as FileSpec).find(
      ([, f]) => f.finalRole === 'baseline',
    )![0];
    for (const fam of ng.resolved as string[])
      await expect(source(page, fam).first()).toContainText('Found');
    for (const key of ng.notInPackage as string[])
      await expect(source(page, key).first()).toContainText('Missing');
    await openPackageFiles(page);
    await expect(
      page
        .getByTestId('package-summary')
        .getByTestId('package-lens-doc')
        .filter({ hasText: baseline })
        .getByTestId('package-lens-doc-role'),
    ).toHaveValue('baseline');
  });
});
