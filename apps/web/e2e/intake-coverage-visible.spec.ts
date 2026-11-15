import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { coverageLine, hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3b (AC-I17): the coverage line shows in the gate popover with the same text
// as the package summary on Documents (the Findings header line and the Package lens are gone).
test.describe('intake-coverage-visible', () => {
  test('should show the same partial coverage line in the gate popover and on Documents', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    const popover = await coverageLine(page);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveText(/^Coverage: partial/);
    const text = (await popover.textContent()) ?? '';
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-documents').click();
    await expect(page.getByTestId('package-summary-line')).toHaveText(text);
  });
});
