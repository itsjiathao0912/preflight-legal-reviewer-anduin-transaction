import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { hartwellFile, RAW_DIR, runPackage, uploadPackage } from './fixtures/package';

// Intake Phase 2 H5 (AC-I6): low rows hold the run until each is confirmed or fixed.
test.describe('intake-low-confidence-gate', () => {
  test('should keep Run checks disabled until every low row is confirmed or fixed', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadPackage(
      page,
      [
        hartwellFile('fund-iii-subscription-agreement.html'),
        {
          name: 'pg-ngi-subscription-agreement.htm',
          buffer: readFileSync(join(RAW_DIR, '05-partners-group-ngi-2024.htm')),
        },
        { name: 'x.html', buffer: Buffer.from('<p>Hello</p>') },
      ],
      { firm: 'Other / no firm', fund: 'Two subs', version: 'v1' },
    );
    const rows = page.getByTestId('package-row');
    await expect(rows).toHaveCount(3);
    const a = rows.filter({ hasText: 'fund-iii-subscription-agreement.html' });
    const b = rows.filter({ hasText: 'pg-ngi-subscription-agreement.htm' });
    const snippet = rows.filter({ hasText: 'x.html' });
    await expect(a).toHaveAttribute('data-confidence', 'low');
    await expect(b).toHaveAttribute('data-confidence', 'low');
    await expect(snippet).toHaveAttribute('data-confidence', 'low');
    await expect(snippet.getByTestId('package-row-type')).toHaveValue('other');
    await expect(a.getByTestId('package-row-low-mark')).toContainText('Needs your confirmation');
    await expect(page.getByTestId('package-run')).toBeDisabled();
    const problems = page.getByTestId('package-notice').getByTestId('package-problem');
    const multiple = problems.and(page.locator('[data-code="multiple_to_digitize"]'));
    await expect(problems.filter({ hasText: 'Confirm or fix x.html' })).toHaveCount(1);
    await expect(a.getByTestId('package-row-role')).toHaveValue('to_digitize');
    await expect(b.getByTestId('package-row-role')).toHaveValue('to_digitize');
    await expect(multiple).toContainText('2 files are set to To digitize');
    // edit one to baseline (an edit confirms it) and confirm the others
    await b.getByTestId('package-row-role').selectOption('baseline');
    await expect(multiple).toHaveCount(0);
    await expect(page.getByTestId('package-run')).toBeDisabled();
    await a.getByTestId('package-row-confirm').check();
    await expect(page.getByTestId('package-run')).toBeDisabled();
    await snippet.getByTestId('package-row-confirm').check();
    await expect(problems).toHaveCount(0);
    await runPackage(page);
  });
});
