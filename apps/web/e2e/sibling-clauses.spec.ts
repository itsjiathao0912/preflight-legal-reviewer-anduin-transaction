import { expect, test } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { chip, chipN, fixture, openCompare, pickPair, upload, waitDiff } from './fixtures/compare';

test.describe('sibling-clauses', () => {
  test('should label an unchanged clause common in sibling mode', async ({ page }) => {
    await gotoApp(page);
    await upload(page, 'sibling-A.html', fixture('sibling-A.html'));
    await upload(page, 'sibling-B.html', fixture('sibling-B.html'));
    await openCompare(page);
    await pickPair(page, 'sibling-A.html (upload)', 'sibling-B.html (upload)');
    await page.getByTestId('cmp-mode-sibling').click();
    await waitDiff(page);
    // seeded expectations (fixtures/diff/expected/sibling-A-vs-B.json): 10 common, 2 differing, 1+1 only
    expect(await chipN(page, 'common')).toBe(10);
    expect(await chipN(page, 'differing')).toBe(2);
    expect(await chipN(page, 'only')).toBe(2);
    await expect(chip(page, 'still')).toBeVisible();
    const item = (text: string) => page.getByTestId('cmp-item').filter({ hasText: text });
    await expect(item('Bank: Example Trust Company')).toHaveAttribute('data-kind', 'common');
    await expect(item('Bank: Example Trust Company')).toContainText('Common');
    await expect(item('Reference:')).toHaveAttribute('data-kind', 'differing');
    await expect(item('feeder fund vehicle only')).toHaveAttribute('data-kind', 'only_a');
    await expect(item('Joint Subscriber')).toHaveAttribute('data-kind', 'only_b');
    await item('Bank: Example Trust Company').click();
    await expect(page.getByTestId('cmp-detail')).toContainText('Common');
    await chip(page, 'differing').click();
    await expect(page.getByTestId('cmp-item')).toHaveCount(2);
  });
});
