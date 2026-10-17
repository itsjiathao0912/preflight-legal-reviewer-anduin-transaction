import { expect, test } from '@playwright/test';
import { chooseReasonAndSave, forceSeverity, gotoApp, openSample, row } from './fixtures/app';
import { engineFindings, seedMemory } from './fixtures/seedMemory';

// Phase 02 (E9): new AC10 flags (NTD, placeholders, sensitive) join the #5 findings. Golden picks
// are by detector, counts are derived from engine output, never by engine index or a literal.
const goldens = (id: string) =>
  engineFindings(id).filter((f) => f.detector_id === 'ref-label-coherence');
const left = (n: number) => `${n} blocking reason${n > 1 ? 's' : ''} left.`;

test.describe('gate-pill', () => {
  test('should keep the gate Blocked after Accept on a critical finding; Dismiss with a reason lowers N', async ({
    page,
  }) => {
    await gotoApp(page);
    await forceSeverity(page, 'critical');
    await openSample(page, '05');
    const [a, b] = goldens('05');
    const n = engineFindings('05').length;
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n}`));
    await expect(page.getByTestId('findings-meta')).toHaveText(
      `${n} open · ${n} block digitization`,
    );
    await row(page, a!.id).click();
    await page.getByTestId('action-accept').click();
    await expect(row(page, a!.id)).toHaveAttribute('data-status', 'accepted');
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n}`));
    await row(page, b!.id).click();
    await page.getByTestId('action-dismiss').click();
    await chooseReasonAndSave(page);
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n - 1}`));
    await expect(page.getByTestId('undo-toast')).toContainText(left(n - 1));
  });

  test('a reconfirm item stays counted; a counsel answer on it (D-2) lowers N', async ({
    page,
  }) => {
    await gotoApp(page);
    const [a] = goldens('05');
    const n = engineFindings('05').length;
    await seedMemory(page, [
      { finding: a!, firmId: 'partners-group', decision: 'dismissed', fund: 'Master Fund 2019' },
    ]);
    await forceSeverity(page, 'critical');
    await openSample(page, '05');
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n}`));
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
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n - 1}`));
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
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · ${n}`));
  });

  test('no document open: the pill is neutral (never the green Ready state)', async ({ page }) => {
    await gotoApp(page);
    const gate = page.getByTestId('gate-button');
    await expect(gate).toHaveText(/No document/);
    await expect(gate).not.toHaveText(/Ready to digitize/);
    await expect(gate).toHaveAttribute('data-gate-state', 'none');
    await expect(gate).not.toHaveClass(/ready/);
    await gate.click();
    await expect(page.getByTestId('gate-popover')).toContainText('No document open');
    await expect(page.getByTestId('gate-reason')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // a document with nothing critical (#6) -> Ready
    await openSample(page, '06');
    expect(engineFindings('06').some((f) => f.severity === 'critical')).toBe(false);
    await expect(gate).toHaveText(/Ready to digitize/);
    await expect(gate).toHaveAttribute('data-gate-state', 'ready');
  });

  test('real #5 blocks with no forced severity: the 2 swapped instruction refs are critical', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '05');
    const critical = engineFindings('05').filter((f) => f.severity === 'critical');
    expect(critical.map((f) => f.detector_id)).toEqual([
      'ref-label-coherence',
      'ref-label-coherence',
    ]);
    await expect(page.getByTestId('gate-button')).toHaveText(new RegExp(`Blocked · 2`));
    await expect(page.getByTestId('gate-button')).toHaveAttribute('data-gate-state', 'blocked');
  });

  test('gate popover reasons jump to the finding', async ({ page }) => {
    await gotoApp(page);
    const b = goldens('05')[1]!;
    // only b is critical; every other finding (incl. the other golden) is forced to high
    await page.evaluate((id) => {
      const h = (window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } })
        .__aduinE2E;
      h.transform((fs: { id: string; severity: string }[]) =>
        fs.map((f) => ({ ...f, severity: f.id === id ? 'critical' : 'high' })),
      );
    }, b.id);
    await openSample(page, '05');
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
