import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog } from './fixtures/app';
import { hartwellFile, uploadPackage, waitForChecks } from './fixtures/package';

// Intake Phase 2 H7 (AC-I9): a baseline comes from the same firm only; identical text from another
// firm is never offered.
async function singleUpload(page: Page, firm: string) {
  await openDialog(page);
  const f = hartwellFile('fund-ii-subscription-agreement-prior.html');
  await page
    .getByTestId('upload-input')
    .setInputFiles({ name: 'earlier-fund-ii.html', mimeType: 'text/html', buffer: f.buffer });
  await page.getByTestId('firm-combobox').fill(firm);
  await page.getByTestId('fund-input').fill('Fund II');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await waitForChecks(page);
}

const pkgFiles = () => [
  hartwellFile('fund-iii-subscription-agreement.html'),
  hartwellFile('northgate-lpa-definitions.docx'),
];

test.describe('intake-baseline-role-same-firm', () => {
  test('should never offer or accept a baseline from another firm with identical text', async ({
    page,
  }) => {
    await gotoApp(page);
    await singleUpload(page, 'Firm X');
    // firm Y package: nothing offered
    await uploadPackage(page, pkgFiles(), { firm: 'Firm Y', fund: 'Fund III', version: 'v1' });
    await expect(page.getByTestId('package-confirm-table')).toBeVisible();
    await expect(page.getByTestId('package-row')).toHaveCount(2);
    await expect(page.getByTestId('package-earlier-add')).toHaveCount(0);
    await page.getByTestId('package-back').click();
    // firm X package: the earlier document is offered and becomes a baseline
    await uploadPackage(page, pkgFiles(), { firm: 'Firm X', fund: 'Fund III', version: 'v1' });
    const add = page.getByTestId('package-earlier-list').getByTestId('package-earlier-add');
    await expect(add).toHaveCount(1);
    await expect(add).toContainText('earlier-fund-ii.html');
    await add.click();
    const added = page.getByTestId('package-row').filter({ hasText: 'earlier-fund-ii.html' });
    await expect(added.getByTestId('package-row-role')).toHaveValue('baseline');
    await expect(page.getByTestId('package-earlier-add')).toHaveCount(0);
  });
});
