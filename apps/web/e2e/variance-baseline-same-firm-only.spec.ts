import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  changeRows,
  NGI_2024,
  NGI_2026,
  rawFile,
  uploadOne,
  varianceSettled,
} from './fixtures/variance';

// Variance Phase 02 (AC-V1): a baseline comes from the same firm only. Another firm's document with
// identical text is never offered or used.
test.describe('variance-baseline-same-firm-only', () => {
  test('should never offer another firm’s document even with identical text', async ({ page }) => {
    await gotoApp(page);
    // Firm X reviews the 2024 form first (it becomes Firm X's baseline)
    await uploadOne(page, rawFile(NGI_2024, 'firm-x-ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    // Firm Y opens the 2026 form: nothing from Firm X is offered or used
    await uploadOne(page, rawFile(NGI_2026, 'firm-y-ngi-2026.htm'), {
      firm: 'Firm Y',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    await expect(changeRows(page)).toHaveCount(0);
    await expect(page.getByTestId('baseline-control')).toContainText('No baseline');
    await page.getByTestId('baseline-control').click();
    await expect(page.getByTestId('baseline-none')).toBeVisible();
    await expect(page.getByTestId('baseline-option')).toHaveCount(0);
    await expect(page.getByTestId('baseline-modal')).not.toContainText('firm-x-ngi-2024.htm');
    await page.getByTestId('baseline-cancel').click();
    // identical text of Firm Y's own earlier document IS used; Firm X's copy still never offered
    await uploadOne(page, rawFile(NGI_2024, 'firm-y-ngi-2024.htm'), {
      firm: 'Firm Y',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await page.getByTestId('baseline-control').click();
    const options = page.getByTestId('baseline-modal').locator('label');
    await expect(options).toHaveCount(1);
    await expect(options).toHaveText('firm-y-ngi-2026.htm');
    await page.getByTestId('baseline-cancel').click();
  });
});
