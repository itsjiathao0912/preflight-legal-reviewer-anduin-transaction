import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { confirmAllRows, hartwellFile, uploadPackage } from './fixtures/package';

// Intake Phase 2 H8 (AC-I19 visible half): no subscription agreement holds the run.
test.describe('intake-no-sub-agreement-held', () => {
  test('should hold the run and show the no-subscription-agreement line for an LPA-only package', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadPackage(
      page,
      [
        hartwellFile('northgate-lpa-definitions.docx'),
        { name: 'notes.html', buffer: Buffer.from('<p>Notes</p>') },
      ],
      { firm: 'Other / no firm', fund: 'LPA only', version: 'v1' },
    );
    await expect(page.getByTestId('package-row')).toHaveCount(2);
    await confirmAllRows(page);
    await expect(page.getByTestId('package-notice')).toContainText(
      'No subscription agreement in this package. Checks need one.',
    );
    await expect(page.getByTestId('package-run')).toBeDisabled();
  });
});
