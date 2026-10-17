import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3b (AC-I18): a partial package shows the coverage line next to the gate.
test.describe('intake-coverage-next-to-gate', () => {
  test('should show the gate and the coverage line together and name what is missing', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    const line = page.getByTestId('findings-coverage-line');
    await expect(page.getByTestId('gate-button')).toBeVisible();
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('data-status', /partial|blocked/);
    await expect(line).toContainText(/LPA|PPM|missing|no /i);
  });
});
