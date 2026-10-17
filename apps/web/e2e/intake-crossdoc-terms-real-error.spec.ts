import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  confirmAllRows,
  hartwellFile,
  hartwellFiles,
  runPackage,
  uploadPackage,
  waitForChecks,
} from './fixtures/package';

// Intake Phase 3 track 3a (AC-I15): a term defined nowhere stays an error. With the LPA, "Stock"
// is still flagged; without the LPA both offering nouns ("Units" and "Stock") stay flagged.
const unitsTitle = '"Units" is used for the offered security';
const stockTitle = '"Stock" is used for the offered security';

test.describe('intake-crossdoc-terms-real-error', () => {
  test('should keep the Stock finding with the LPA present', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoApp(page);
    await uploadPackage(page, hartwellFiles(), {
      firm: 'Other / no firm',
      fund: 'Hartwell Fund III',
      version: 'v1',
    });
    await confirmAllRows(page);
    await runPackage(page);
    await expect(page.getByTestId('finding-title').filter({ hasText: stockTitle })).toHaveCount(1);
  });

  test('should keep both noun findings without the LPA', async ({ page }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    const titles = page.getByTestId('finding-title');
    await expect(titles.filter({ hasText: stockTitle })).toHaveCount(1);
    await expect(titles.filter({ hasText: unitsTitle })).toHaveCount(1);
  });
});
