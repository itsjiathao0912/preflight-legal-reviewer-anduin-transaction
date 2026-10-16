import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, forceSeverity, gotoApp, openSample, row } from './fixtures/app';
import { engineFindings, seedMemory } from './fixtures/seedMemory';

test.describe('gate-pill', () => {
  test('should keep the gate Blocked after Accept on a critical finding; Dismiss with a reason lowers N', async ({
    page,
  }) => {
    await gotoApp(page);
    await forceSeverity(page, 'critical');
    await openSample(page, '05');
    const [a, b] = engineFindings('05');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await expect(page.getByTestId('findings-meta')).toHaveText('2 open · 2 block digitization');
    await row(page, a!.id).click();
    await page.getByTestId('action-accept').click();
    await expect(row(page, a!.id)).toHaveAttribute('data-status', 'accepted');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await row(page, b!.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page);
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 1/);
    await expect(page.getByTestId('undo-toast')).toContainText('1 blocking reason left.');
  });

  test('a reconfirm item stays counted; a counsel answer on it (D-2) lowers N', async ({
    page,
  }) => {
    await gotoApp(page);
    const [a] = engineFindings('05');
    await seedMemory(page, [
      { finding: a!, firmId: 'partners-group', decision: 'dismissed', fund: 'Master Fund 2019' },
    ]);
    await forceSeverity(page, 'critical');
    await openSample(page, '05');
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
    await page.evaluate(async (id) => {
      const h = (
        window as unknown as {
          __aduinE2E: {
            review: () => { setCounselAnswer: (i: string, o: string) => Promise<void> };
          };
        }
      ).__aduinE2E;
      await h.review().setCounselAnswer(id, 'A');
    }, a!.id);
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 1/);
    await page.evaluate(async (id) => {
      const h = (
        window as unknown as {
          __aduinE2E: {
            review: () => { setCounselAnswer: (i: string, o: string) => Promise<void> };
          };
        }
      ).__aduinE2E;
      await h.review().setCounselAnswer(id, 'unclear');
    }, a!.id);
    await expect(page.getByTestId('gate-button')).toHaveText(/Blocked · 2/);
  });

  test('gate popover reasons jump to the finding; ready state when nothing blocks', async ({
    page,
  }) => {
    await gotoApp(page);
    await expect(page.getByTestId('gate-button')).toHaveText(/Ready to digitize/);
    await forceSeverity(page, 'critical', 1);
    await openSample(page, '05');
    const b = engineFindings('05')[1]!;
    await page.getByTestId('nav-structure').click();
    await page.getByTestId('gate-button').click();
    await expect(page.getByTestId('gate-popover')).toBeVisible();
    await expect(page.getByTestId('gate-reason')).toHaveCount(1);
    await page.getByTestId('gate-reason').click();
    await expect(page.getByTestId('findings-header')).toBeVisible();
    await expect(row(page, b.id)).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.locator(`[data-testid="doc-highlight"][data-finding-id="${b.id}"]`).first(),
    ).toBeInViewport();
  });
});
