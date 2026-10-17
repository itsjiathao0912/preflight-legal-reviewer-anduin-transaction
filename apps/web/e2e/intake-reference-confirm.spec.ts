import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFile,
  runPackage,
  uploadPackage,
  type UploadFile,
} from './fixtures/package';

// Intake Phase 3 track 3a (AC-I12 UI): two LPA files make the "Partnership Agreement" reference
// unclear; the lens asks for confirmation (never guesses) and the choice updates the row and the
// coverage line. The second LPA is an inline buffer with different content (no duplicate collapse).
const AMENDED: UploadFile = {
  name: 'amended-and-restated-lpa.html',
  mimeType: 'text/html',
  buffer: Buffer.from(
    `<!doctype html><html><head><title>Amended and Restated Limited Partnership Agreement</title></head><body>
<h1>Amended and Restated Limited Partnership Agreement of Hartwell Fund III, L.P.</h1>
<h2>Article I. Definitions</h2>
<p>"Units" means the amended limited partnership interests issued by the Partnership.</p>
<p>"Capital Commitment" means the amount a Limited Partner agrees to contribute, as amended.</p>
<p>"Closing Date" means each date on which the General Partner admits Limited Partners.</p>
</body></html>`,
    'utf8',
  ),
};

async function runTwoLpas(page: Page) {
  await gotoApp(page);
  await uploadPackage(
    page,
    [
      hartwellFile('fund-iii-subscription-agreement.html'),
      hartwellFile('northgate-lpa-definitions.docx'),
      AMENDED,
    ],
    { firm: 'Other / no firm', fund: 'Hartwell Fund III', version: 'v1' },
  );
  const rows = page.getByTestId('package-row');
  await expect(rows).toHaveCount(3, { timeout: 60_000 });
  for (const name of ['northgate-lpa-definitions.docx', AMENDED.name]) {
    const r = rows.filter({ hasText: name });
    await r.getByTestId('package-row-type').selectOption('lpa');
    await r.getByTestId('package-row-role').selectOption('reference');
  }
  await confirmAllRows(page);
  await runPackage(page);
  await page.getByTestId('nav-structure').click();
  await page.getByTestId('structure-lens-package').click();
  const lpa = page.locator('[data-testid="package-reference"][data-target-key="lpa"]');
  await expect(lpa.first()).toHaveAttribute('data-resolution', 'unclear');
  await expect(lpa.first()).toContainText('Needs confirmation');
  const select = lpa.first().getByTestId('package-reference-confirm');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(
    expect.arrayContaining(['northgate-lpa-definitions.docx', AMENDED.name, 'None of these']),
  );
  return { lpa, select, before: (await page.getByTestId('package-lens-line').textContent()) ?? '' };
}

test.describe('intake-reference-confirm', () => {
  test('should resolve an unclear reference to the chosen LPA', async ({ page }) => {
    test.setTimeout(120_000);
    const { lpa, select, before } = await runTwoLpas(page);
    const value = await select.locator('option', { hasText: AMENDED.name }).getAttribute('value');
    await select.selectOption(value!);
    await expect(lpa.first()).toHaveAttribute('data-resolution', 'resolved');
    await expect(lpa.first()).toContainText(`Resolved to ${AMENDED.name}`);
    await expect(page.getByTestId('package-lens-line')).not.toHaveText(before);
  });

  test('should mark the reference not in package for "None of these"', async ({ page }) => {
    test.setTimeout(120_000);
    const { lpa, select, before } = await runTwoLpas(page);
    await select.selectOption('none');
    await expect(lpa.first()).toHaveAttribute('data-resolution', 'not_in_package');
    await expect(lpa.first()).toContainText('Not in package');
    await expect(page.getByTestId('package-lens-line')).not.toHaveText(before);
  });
});
