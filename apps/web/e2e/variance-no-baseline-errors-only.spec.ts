import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  changeRows,
  errorRows,
  NGI_2024,
  NGI_2026,
  rawFile,
  scanPage,
  uploadOne,
  varianceSettled,
} from './fixtures/variance';

// Variance Phase 02 (AC-V8): no earlier document of the firm -> errors only with the muted line and
// an empty Changes filter; the document then becomes the firm's baseline and is offered next time.
const NO_BASELINE =
  'No earlier document from this firm. Reviewing for errors only. This document becomes the baseline.';

test.describe('variance-no-baseline-errors-only', () => {
  test('should run errors only with the muted line when no baseline exists and then offer this document as the firm baseline', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await expect(page.getByTestId('variance-line')).toHaveText(NO_BASELINE);
    await expect(page.getByTestId('kind-changes')).toContainText('Changes0');
    await expect(changeRows(page)).toHaveCount(0);
    const errors = await errorRows(page).count();
    expect(errors).toBeGreaterThan(0);
    await expect(page.getByTestId('kind-errors')).toContainText(`Errors${errors}`);
    await expect(page.getByTestId('baseline-control')).toContainText('No baseline');
    // the Changes filter shows an empty state; errors work as today
    await page.getByTestId('kind-changes').click();
    await expect(page.getByTestId('empty-state')).toHaveText('No changes against a baseline.');
    await page.getByTestId('kind-all').click();
    await expect(errorRows(page)).toHaveCount(errors);
    // counsel is unaffected on a no-baseline run: Questions holds no change rows
    await errorRows(page).first().click();
    await page.getByTestId('action-counsel').click();
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-meta')).toHaveText('1 question · 1 unanswered');
    await page.getByTestId('nav-findings').click();

    // next document of the same firm: the first one is the baseline now
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    await expect(page.getByTestId('baseline-control')).toContainText('vs ngi-2024.htm');
    await expect(page.getByTestId('variance-line')).toHaveCount(0);
    await expect(changeRows(page).first()).toBeVisible();
    await page.getByTestId('baseline-control').click();
    await expect(page.getByTestId('baseline-option')).toHaveCount(1);
    await expect(page.getByTestId('baseline-modal')).toContainText('ngi-2024.htm');
    await expect(page.getByTestId('baseline-option')).toBeChecked();
    await expect(page.getByTestId('baseline-error')).toHaveText('');
    await page.getByTestId('baseline-cancel').click();
  });

  test('a scanned current document shows the muted variance line and keeps errors-only behavior', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadOne(page, scanPage(), { firm: 'Firm X', fund: 'Scan' });
    await varianceSettled(page);
    await expect(page.getByTestId('variance-line')).toHaveText(
      'Variance unavailable for scanned documents.',
    );
    await expect(changeRows(page)).toHaveCount(0);
  });
});
