import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 3 track 3b (AC-I19 UI): Hartwell Fund III without its LPA only warns; the gate
// label stays what the core findings dictate.
test.describe('intake-gate-warning-policy', () => {
  test('should warn for the missing LPA without adding a block reason', async ({ page }) => {
    await gotoApp(page);
    await uploadPackage(page, [hartwellFile('fund-iii-subscription-agreement.html')], {
      firm: 'Other / no firm',
      fund: 'Fund III',
    });
    await waitForChecks(page);
    const btn = page.getByTestId('gate-button');
    await btn.click();
    const pop = page.getByTestId('gate-popover');
    await expect(pop.getByTestId('package-gate-warning').first()).toBeVisible();
    await expect(pop.getByTestId('package-gate-warning').first()).toHaveAttribute(
      'data-level',
      'warn',
    );
    await expect(pop.getByTestId('package-gate-reason')).toHaveCount(0);
    // Core gate: the blocked count equals the core reasons listed in the popover (the Findings
    // header "N block digitization" line is gone).
    const n = await pop.getByTestId('gate-reason').count();
    if (n === 0) await expect(btn).toContainText('Ready to digitize');
    else await expect(btn).toContainText(`Blocked · ${n}`);
  });
});
