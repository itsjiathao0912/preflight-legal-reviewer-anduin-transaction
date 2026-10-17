import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3b (AC-I17): the coverage line shows in the Findings header and the gate
// popover with the same text as the Package lens line.
test.describe('intake-coverage-visible', () => {
  test('should show the same partial coverage line in header, popover and lens', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    const header = page.getByTestId('findings-coverage-line');
    await expect(header).toBeVisible();
    await expect(header).toHaveText(/^Coverage: partial/);
    const text = (await header.textContent()) ?? '';
    await page.getByTestId('gate-button').click();
    await expect(page.getByTestId('gate-coverage-line')).toHaveText(text);
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('structure-lens-package').click();
    await expect(page.getByTestId('package-lens-line')).toHaveText(text);
  });
});
