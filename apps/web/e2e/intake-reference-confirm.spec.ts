import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openFindingsView } from './fixtures/app';
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

/** The package coverage line on Documents, then back to the Sources view. */
async function summaryLine(page: Page): Promise<string> {
  await page.getByTestId('nav-documents').click();
  const text = (await page.getByTestId('package-summary-line').textContent()) ?? '';
  await openFindingsView(page, 'sources');
  return text;
}

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
  await openFindingsView(page, 'sources');
  const lpa = page.locator('[data-testid="sources-row"][data-target-key="lpa"]');
  await expect(lpa).toContainText('Pick a file');
  const select = lpa.getByTestId('sources-confirm');
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(
    expect.arrayContaining(['northgate-lpa-definitions.docx', AMENDED.name, 'None of these']),
  );
  return { lpa, select, before: await summaryLine(page) };
}

test.describe('intake-reference-confirm', () => {
  test('should resolve an unclear reference to the chosen LPA', async ({ page }) => {
    test.setTimeout(120_000);
    const { lpa, select, before } = await runTwoLpas(page);
    const value = await select.locator('option', { hasText: AMENDED.name }).getAttribute('value');
    await select.selectOption(value!);
    await expect(lpa).toContainText('Found');
    await expect(lpa.getByTestId('sources-open-file')).toBeVisible();
    expect(await summaryLine(page)).not.toBe(before);
  });

  test('should mark the reference not in package for "None of these"', async ({ page }) => {
    test.setTimeout(120_000);
    const { lpa, select, before } = await runTwoLpas(page);
    await select.selectOption('none');
    await expect(lpa).toContainText('Missing');
    expect(await summaryLine(page)).not.toBe(before);
  });
});
