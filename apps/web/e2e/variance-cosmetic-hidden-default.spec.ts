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

// Variance Phase 02 (AC-V3): cosmetic changes are hidden by default with their count stated; the
// filter reveals at most 5 grouped rows (plus one muted overflow line). Cosmetic changes are never rows.
test.describe('variance-cosmetic-hidden-default', () => {
  test('should hide cosmetic changes by default and reveal at most 5 grouped rows on request', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Partners Group',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Partners Group',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    const changes = await changeRows(page).count();
    expect(changes).toBeGreaterThan(0);
    await expect(page.getByTestId('kind-changes')).toContainText(`Changes${changes}`);
    // hidden by default, count stated (summary.cosmetic hunks)
    const toggle = page.getByTestId('show-cosmetic');
    await expect(toggle).not.toBeChecked();
    const label = page.getByTestId('cosmetic-groups').locator('label');
    await expect(label).toHaveText(/^Show cosmetic changes \((\d+)\)$/);
    const n = Number((await label.textContent())!.match(/\((\d+)\)/)![1]);
    expect(n).toBeGreaterThan(0);
    await expect(page.getByTestId('cosmetic-group')).toHaveCount(0);
    // cosmetic hunks never become rows: the change rows did not grow
    await toggle.check();
    const groups = page.getByTestId('cosmetic-group');
    await expect(groups.first()).toBeVisible();
    const g = await groups.count();
    expect(g).toBeGreaterThan(0);
    expect(g).toBeLessThanOrEqual(5);
    await expect(changeRows(page)).toHaveCount(changes);
    // this pair has more than 5 groups: the overflow is one muted line
    await expect(page.getByTestId('cosmetic-more')).toHaveText(
      /^\+\d+ more groups \(\d+ changes\)$/,
    );
    // the Errors segment hides change rows and the cosmetic option
    await page.getByTestId('kind-errors').click();
    await expect(changeRows(page)).toHaveCount(0);
    await expect(page.getByTestId('cosmetic-groups')).toHaveCount(0);
    await page.getByTestId('kind-changes').click();
    await expect(changeRows(page)).toHaveCount(changes);
    await expect(page.locator('[data-testid="finding-row"]:not([data-kind="change"])')).toHaveCount(
      0,
    );
    // the filter state survives a reload
    await page.reload();
    await expect(page.getByTestId('kind-changes')).toHaveAttribute('aria-pressed', 'true', {
      timeout: 30_000,
    });
  });
});
