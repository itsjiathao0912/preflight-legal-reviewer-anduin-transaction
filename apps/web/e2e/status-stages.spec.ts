import { expect, test } from '@playwright/test';
import { gotoApp, openSample } from './fixtures/app';

async function stages(page: import('@playwright/test').Page) {
  await page.getByTestId('stage-status-button').click();
  const pop = page.getByTestId('stage-popover');
  await expect(pop).toBeVisible();
  return pop;
}

test.describe('status-stages', () => {
  // Phase 05 (G11, deliberate): the AI stage is now the AI lane. The preview build has no Worker
  // (API base ''), so the lane fails soft: "not connected" (was the Phase 03 stub "pending").
  test('named stages; AI review shows not connected in the preview build', async ({ page }) => {
    await gotoApp(page);
    await openSample(page, '01');
    await expect(page.getByTestId('stage-status-button')).toHaveText(
      /Checks done · AI review not connected/,
    );
    const pop = await stages(page);
    await expect(pop.locator('[data-testid=stage-item] .lab')).toHaveText([
      'Reading',
      'Structuring',
      'Checks',
      'AI review',
      'Done',
    ]);
    await expect(pop.locator('[data-stage=read]')).toHaveAttribute('data-state', 'done');
    await expect(pop.locator('[data-stage=checks]')).toHaveAttribute('data-state', 'done');
    await expect(pop.locator('[data-stage=ai]')).toHaveAttribute('data-state', 'skipped');
    await expect(pop.locator('[data-stage=ai]')).toContainText(
      'Skipped · AI review is not connected in this build',
    );
    await expect(pop.locator('[data-stage=done]')).toContainText('Done · rules only');
  });

  test('an injected checks failure gives a partial result naming the stage', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() =>
      (
        window as unknown as { __aduinE2E: { failStage: (s: string) => void } }
      ).__aduinE2E.failStage('checks'),
    );
    await openSample(page, '01');
    await expect(page.getByTestId('stage-status-button')).toHaveText(
      /Checks failed · partial result/,
    );
    await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
    await expect(page.getByTestId('finding-row')).toHaveCount(0);
    const pop = await stages(page);
    await expect(pop.locator('[data-stage=checks]')).toHaveAttribute('data-state', 'failed');
    await expect(pop.locator('[data-stage=done]')).toContainText('Partial result · Checks failed');
  });

  test('an injected structure failure still shows the plain text', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() =>
      (
        window as unknown as { __aduinE2E: { failStage: (s: string) => void } }
      ).__aduinE2E.failStage('structure'),
    );
    await openSample(page, '01');
    await expect(page.getByTestId('stage-status-button')).toHaveText(
      /Structuring failed · partial result/,
    );
    await expect(page.getByTestId('doc-pane').locator('.paper p').first()).toBeVisible();
    const pop = await stages(page);
    await expect(pop.locator('[data-stage=checks]')).toHaveAttribute('data-state', 'skipped');
  });

  test('AI off: the AI stage is skipped and the banner shows', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('ai-off').click();
    await openSample(page, '01');
    await expect(page.getByTestId('stage-status-button')).toHaveText(/AI review off/);
    await expect(page.getByTestId('ai-off-banner')).toBeVisible();
    const pop = await stages(page);
    await expect(pop.locator('[data-stage=ai]')).toHaveAttribute('data-state', 'skipped');
  });
});
