import { expect, test, type Page } from '@playwright/test';
import { findingsV2Widths } from '../test/support/mockupCss';
import { DOCZOOM_KEY, gotoApp, openSample, row, rowsLoc } from './fixtures/app';
import { askCounsel, closeAsRealIssue, closeWithReason } from './fixtures/findings-actions';
import { changeRow, openFundIIIvsII } from './fixtures/variance-owners';

/**
 * Findings v2 in the real app (Phase B5): sticky bar (D1, D3), Close issue modal (D2), outcome
 * toast with Undo (D12), groups and progress (D8), resizable panel (D4), document zoom (D15),
 * shortcuts (D14), done state, focus return (P-15) and the Variance change row (P-5).
 */

const FPW_KEY = 'ui:v1:fpw';

/** Keep the first `sevs.length` engine findings and give them these severities (in engine order). */
async function seed(page: Page, sevs: readonly ('critical' | 'high' | 'medium')[]) {
  await page.evaluate((s) => {
    (
      window as unknown as { __aduinE2E: { transform: (fn: unknown) => void } }
    ).__aduinE2E.transform((fs: { severity: string }[]) =>
      fs.slice(0, s.length).map((f, i) => ({ ...f, severity: s[i] })),
    );
  }, sevs);
}

/** Row ids in list order. */
const ids = (page: Page) =>
  rowsLoc(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-finding-id')!));

const idOf = async (page: Page, sev: 'block' | 'fix' | 'note') =>
  (await page
    .locator(`[data-testid="finding-row"][data-severity="${sev}"]`)
    .first()
    .getAttribute('data-finding-id'))!;

const openIdx = (page: Page) =>
  rowsLoc(page).evaluateAll((els) =>
    els.findIndex((e) => e.getAttribute('aria-expanded') === 'true'),
  );

const toast = (page: Page) => page.getByTestId('undo-toast');
const zoomPane = (page: Page) => page.getByTestId('doc-pane');
const dz = async (page: Page) => Number(await zoomPane(page).getAttribute('data-dz'));
const valueNow = async (page: Page) =>
  Number(await page.getByTestId('panel-resizer').getAttribute('aria-valuenow'));

test.describe('findings-v2', () => {
  test('sticky bar acts on the open row, opens the next one, toast Undo restores (D1, D3, D12)', async ({
    page,
  }) => {
    await gotoApp(page);
    await seed(page, ['critical', 'high', 'medium']);
    await openSample(page, '01');
    await expect(rowsLoc(page)).toHaveCount(3);

    // the bar is pinned to the bottom of the panel, full panel width
    const panel = (await page.getByTestId('findings-column').boundingBox())!;
    const bar = (await page.getByTestId('action-bar').boundingBox())!;
    expect(Math.abs(bar.y + bar.height - (panel.y + panel.height))).toBeLessThanOrEqual(2);
    expect(bar.width).toBeGreaterThanOrEqual(panel.width - 24);

    await expect(page.getByTestId('progress-text')).toHaveText('0 of 3 reviewed');
    const block = await idOf(page, 'block');
    await row(page, block).click();
    await expect(page.getByTestId('action-counsel')).toHaveText('Ask counsel');
    await expect(page.getByTestId('action-dismiss')).toHaveText('Close issue');
    await page.getByTestId('action-counsel').click();
    await expect(row(page, block)).toHaveAttribute('data-status', 'accepted');
    await expect(toast(page)).toContainText(
      /Sent to counsel · Counsel questions now 1 · Gate still blocked \(\d+\)/,
    );
    // the next To-review row opens
    const after = await ids(page);
    const opened = after[await openIdx(page)]!;
    expect(opened).not.toBe(block);
    await expect(row(page, opened)).toHaveAttribute('data-status', 'open');
    await expect(page.getByTestId('group-sent')).toContainText('Sent to counsel');
    await expect(page.getByTestId('group-sent')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('progress-text')).toHaveText('1 of 3 reviewed');

    // Undo restores the row and the counts
    await page.getByTestId('undo-button').click();
    await expect(row(page, block)).toHaveAttribute('data-status', 'open');
    await expect(page.getByTestId('group-sent')).toHaveCount(0);
    await expect(page.getByTestId('progress-text')).toHaveText('0 of 3 reviewed');

    // Move back to review on a sent row
    await askCounsel(page, block);
    await row(page, block).click();
    await expect(page.getByTestId('action-counsel')).toHaveCount(0);
    await expect(page.getByTestId('action-restore')).toBeEnabled();
    await page.getByTestId('action-restore').click();
    await expect(row(page, block)).toHaveAttribute('data-status', 'open');
    await expect(toast(page)).toContainText('Moved back to review · Counsel questions now 0');
  });

  test('Close issue modal: reason required, Other needs a note, Real issue hidden on blocking (D2)', async ({
    page,
  }) => {
    await gotoApp(page);
    await seed(page, ['critical', 'high']);
    await openSample(page, '01');
    const block = await idOf(page, 'block');
    const fix = await idOf(page, 'fix');

    await row(page, block).click();
    await page.getByTestId('action-dismiss').click();
    const modal = page.getByTestId('dismiss-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Close issue' })).toBeVisible();
    await expect(page.getByTestId('dismiss-reason')).toHaveCount(4);
    await expect(
      page.locator('[data-testid="dismiss-reason"][data-reason="real_issue"]'),
    ).toHaveCount(0);
    // no reason: error, the modal stays
    await page.getByTestId('dismiss-save').click();
    await expect(page.getByTestId('dismiss-error')).not.toBeEmpty();
    await expect(modal).toBeVisible();
    // Other without a note: error; with a note: saves
    await page.locator('[data-testid="dismiss-reason"][data-reason="other"]').check();
    await page.getByTestId('dismiss-save').click();
    await expect(page.getByTestId('dismiss-error')).toContainText('Add a note for "Other".');
    await expect(page.getByTestId('dismiss-note')).toBeFocused();
    await page.getByTestId('dismiss-note').fill('Counsel confirmed by phone');
    await page.getByTestId('dismiss-save').click();
    await expect(modal).toBeHidden();
    await expect(toast(page)).toContainText(/^Closed · Gate/);
    await expect(row(page, block)).toHaveCount(0);

    // a non-blocking row offers Real issue first; it closes as accepted into Closed
    await row(page, fix).click();
    await page.getByTestId('action-dismiss').click();
    await expect(page.getByTestId('dismiss-reason')).toHaveCount(5);
    await expect(page.getByTestId('dismiss-reason').first()).toHaveAttribute(
      'data-reason',
      'real_issue',
    );
    await page.getByTestId('dismiss-cancel').click();
    await closeAsRealIssue(page, fix);
    await expect(toast(page)).toContainText('Closed as a real issue · Gate');
    await expect(page.getByTestId('group-closed')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('group-closed').getByTestId('finding-row')).toHaveAttribute(
      'data-finding-id',
      fix,
    );
    await page.getByTestId('undo-button').click();
    await expect(row(page, fix)).toHaveAttribute('data-status', 'open');
    await expect(page.getByTestId('group-review').getByTestId('finding-row')).toHaveCount(1);
  });

  test('groups, progress and the done state; the bar is disabled with nothing open (D3, D8)', async ({
    page,
  }) => {
    await gotoApp(page);
    await seed(page, ['high', 'medium']);
    await openSample(page, '01');
    const [a, b] = await ids(page);
    await expect(page.getByTestId('group-review')).toHaveAttribute('data-count', '2');
    await expect(page.getByTestId('progress-counts')).toHaveText('Counsel 0 · Closed 0 · Left 2');

    expect(await askCounsel(page, a!)).toBe('counsel');
    await expect(row(page, b!)).toHaveAttribute('aria-expanded', 'true');
    await closeAsRealIssue(page, b!);

    await expect(page.getByTestId('group-review')).toHaveCount(0);
    await expect(page.getByTestId('group-sent')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('group-closed')).toHaveAttribute('data-count', '1');
    await expect(page.getByTestId('progress-text')).toHaveText('2 of 2 reviewed');
    await expect(page.getByTestId('progress-counts')).toHaveText('Counsel 1 · Closed 1 · Left 0');
    await expect(page.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '2');
    const done = page.getByTestId('findings-done');
    await expect(done).toContainText('All findings reviewed');
    await expect(done).toContainText('1 sent to counsel · 1 closed');
    // nothing is open: both bar buttons are disabled
    expect(await openIdx(page)).toBe(-1);
    await expect(page.getByTestId('action-counsel')).toBeDisabled();
    await expect(page.getByTestId('action-dismiss')).toBeDisabled();
  });

  test('panel resize: drag, arrow keys 2 / Shift 10, clamp 40-65, persists across reload (D4)', async ({
    page,
  }) => {
    const ref = findingsV2Widths();
    await gotoApp(page);
    await openSample(page, '01');
    const handle = page.getByTestId('panel-resizer');
    expect(await valueNow(page)).toBe(ref.wide);
    await expect(handle).toHaveAttribute('aria-valuemin', String(ref.min));
    await expect(handle).toHaveAttribute('aria-valuemax', String(ref.max));

    await handle.focus();
    await page.keyboard.press('ArrowLeft');
    expect(await valueNow(page)).toBe(ref.wide + 2);
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await valueNow(page)).toBe(ref.wide + 12);
    await page.keyboard.press('Shift+ArrowLeft');
    expect(await valueNow(page)).toBe(ref.max);
    await page.keyboard.press('ArrowRight');
    expect(await valueNow(page)).toBe(ref.max - 2);
    await page.keyboard.press('Home');
    expect(await valueNow(page)).toBe(ref.min);
    await page.keyboard.press('ArrowRight');
    expect(await valueNow(page)).toBe(ref.min);
    expect(await page.evaluate((k) => localStorage.getItem(k), FPW_KEY)).toBe(String(ref.min));

    // drag the left edge to 45% of the work area
    const work = (await page.locator('.work.fv2-work').boundingBox())!;
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(work.x + work.width * 0.55, h.y + h.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => valueNow(page)).toBe(45);
    expect(await page.evaluate((k) => localStorage.getItem(k), FPW_KEY)).toBe('45');
    const panelW = async () => (await page.getByTestId('findings-column').boundingBox())!.width;
    expect(Math.abs((await panelW()) - work.width * 0.45)).toBeLessThanOrEqual(2);

    await page.reload();
    await expect(page.getByTestId('panel-resizer')).toHaveAttribute('aria-valuenow', '45');
    const work2 = (await page.locator('.work.fv2-work').boundingBox())!;
    expect(Math.abs((await panelW()) - work2.width * 0.45)).toBeLessThanOrEqual(2);
  });

  test('document zoom: fit default, manual buttons and presets, keys, persistence, horizontal scroll (D15)', async ({
    page,
  }) => {
    await gotoApp(page, { zoom: 'fit' });
    await openSample(page, '01');
    const fitBtn = page.getByTestId('zoom-fit');
    await expect(fitBtn).toHaveAttribute('aria-pressed', 'true');
    const expectedFit = async () =>
      zoomPane(page).evaluate((el) =>
        Math.min(175, Math.max(90, Math.round(((el.clientWidth - 64) / 700) * 100))),
      );
    await expect.poll(async () => (await dz(page)) === (await expectedFit())).toBe(true);
    const fit = await dz(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), DOCZOOM_KEY)).toBeNull();

    // manual +/- turn Fit width off (10% steps)
    await page.getByTestId('zoom-in').click();
    await expect(fitBtn).toHaveAttribute('aria-pressed', 'false');
    expect(await dz(page)).toBe(Math.min(200, (Math.floor(fit / 10) + 1) * 10));
    await page.getByTestId('zoom-out').click();
    await page.getByTestId('zoom-out').click();
    expect(await dz(page)).toBe(Math.max(75, Math.min(200, (Math.floor(fit / 10) + 1) * 10) - 20));
    await expect(page.getByTestId('zoom-menu')).toHaveText(`${await dz(page)}% ▾`);

    // presets
    await page.getByTestId('zoom-menu').click();
    await page.getByTestId('zoom-preset-150').click();
    expect(await dz(page)).toBe(150);
    expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), DOCZOOM_KEY))!)).toEqual(
      {
        mode: 'manual',
        pct: 150,
      },
    );
    // above the fit width the document area scrolls horizontally inside itself
    expect(150).toBeGreaterThan(fit);
    const overflow = await zoomPane(page).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeGreaterThan(10);
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(pageOverflow).toBeLessThanOrEqual(0);

    // Cmd/Ctrl = - 0 (0 = back to Fit width), ignored while typing
    await zoomPane(page).focus();
    await page.keyboard.press('Control+Equal');
    expect(await dz(page)).toBe(160);
    await page.keyboard.press('Control+Minus');
    expect(await dz(page)).toBe(150);

    // the zoom survives a reload
    await page.reload();
    await expect(zoomPane(page)).toHaveAttribute('data-dz', '150');
    await expect(fitBtn).toHaveAttribute('aria-pressed', 'false');
    await zoomPane(page).focus();
    await page.keyboard.press('Control+Digit0');
    await expect(fitBtn).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await dz(page)) === (await expectedFit())).toBe(true);
  });

  for (const z of [100, 150] as const) {
    test(`row click and J scroll only the document and the list, never the app shell (zoom ${z})`, async ({
      page,
    }) => {
      await gotoApp(page, { zoom: z });
      await openSample(page, '03');
      const list = await ids(page);
      await row(page, list[Math.min(list.length - 1, 1)]!).click();
      await page.keyboard.press('j');
      await page.waitForTimeout(300);
      const openId = await rowsLoc(page)
        .nth(await openIdx(page))
        .getAttribute('data-finding-id');
      const shell = await page.evaluate(() => {
        const els = [document.documentElement, document.body, document.querySelector('.app')];
        return els.map((e) => (e ? e.scrollTop : 0)).concat(window.scrollY);
      });
      expect(shell).toEqual([0, 0, 0, 0]);
      const head = (await page.getByTestId('findings-header').boundingBox())!;
      expect(head.y).toBeGreaterThanOrEqual(0);
      const mark = page.locator(`[data-testid="doc-highlight"][data-finding-id="${openId}"]`).first();
      const p = (await zoomPane(page).boundingBox())!;
      const m = (await mark.boundingBox())!;
      expect(m.y).toBeGreaterThanOrEqual(p.y - 1);
      expect(m.y + Math.min(m.height, p.height)).toBeLessThanOrEqual(p.y + p.height + 1);
    });
  }

  test('scroll-to-finding still centers the passage at 150% (D7, D15)', async ({ page }) => {
    await gotoApp(page, { zoom: 150 });
    await openSample(page, '01');
    expect(await dz(page)).toBe(150);
    const list = await ids(page);
    const target = list[Math.min(list.length - 1, Math.floor(list.length / 2))]!;
    await row(page, target).click();
    const mark = page.locator(`[data-testid="doc-highlight"][data-finding-id="${target}"]`).first();
    await expect(mark).toBeVisible();
    await expect
      .poll(async () => {
        const p = (await zoomPane(page).boundingBox())!;
        const m = (await mark.boundingBox())!;
        const atEnd = await zoomPane(page).evaluate(
          (el) => el.scrollTop <= 0 || el.scrollTop >= el.scrollHeight - el.clientHeight - 1,
        );
        const inside = m.y >= p.y - 1 && m.y + Math.min(m.height, p.height) <= p.y + p.height + 1;
        const centered = Math.abs(m.y + m.height / 2 - (p.y + p.height / 2)) <= p.height * 0.2;
        return inside && (centered || atEnd);
      })
      .toBe(true);
  });

  test('shortcuts J/K/C/X, ignored while typing or with the modal open; focus return (D14, P-15)', async ({
    page,
  }) => {
    await gotoApp(page);
    await seed(page, ['high', 'medium', 'medium']);
    await openSample(page, '01');
    const [a, b, c] = await ids(page);
    await row(page, a!).click();
    await expect(row(page, a!)).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('j');
    await expect(row(page, b!)).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, b!)).toBeFocused();
    await page.keyboard.press('k');
    await expect(row(page, a!)).toHaveAttribute('aria-expanded', 'true');

    // X opens the modal; keys do nothing while it is open; typing goes into the note
    await page.keyboard.press('x');
    await expect(page.getByTestId('dismiss-modal')).toBeVisible();
    await page.keyboard.press('j');
    await page.keyboard.press('c');
    await expect(row(page, a!)).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, a!)).toHaveAttribute('data-status', 'open');
    await page.getByTestId('dismiss-note').fill('');
    await page.getByTestId('dismiss-note').pressSequentially('jkcx');
    await expect(page.getByTestId('dismiss-note')).toHaveValue('jkcx');
    await expect(row(page, a!)).toHaveAttribute('aria-expanded', 'true');
    // Esc closes and returns focus to Close issue
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dismiss-modal')).toBeHidden();
    await expect(page.getByTestId('action-dismiss')).toBeFocused();

    // C = Ask counsel on the open row; the next row opens
    await page.keyboard.press('c');
    await expect(row(page, a!)).toHaveAttribute('data-status', 'counsel');
    await expect(row(page, b!)).toHaveAttribute('aria-expanded', 'true');

    // after a dismiss focus goes to the newly opened row
    await closeWithReason(page, b!, 'tool_false_alarm');
    await expect(row(page, c!)).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, c!)).toBeFocused();
  });

  test('a Variance change row keeps the owner chip and the bar reads Ask owner (P-5)', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFundIIIvsII(page);
    const tax = changeRow(page, /Tax Status/);
    await expect(tax.getByTestId('owner-chip')).toHaveText('Counsel');
    await tax.click();
    await expect(tax).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('action-counsel')).toHaveText('Ask owner');
    await expect(page.getByTestId('action-dismiss')).toHaveText('Mark as expected...');
    await page.getByTestId('action-counsel').click();
    await expect(tax).toHaveAttribute('data-status', 'counsel');
    await expect(toast(page)).toContainText('Sent to counsel · Counsel questions now');
    await expect(tax.getByTestId('owner-chip')).toHaveText('Counsel');
  });
});
