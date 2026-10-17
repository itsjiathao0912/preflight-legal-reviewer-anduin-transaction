import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import {
  changeRows,
  errorRows,
  NGI_2024,
  NGI_2026,
  rawFile,
  uploadOne,
  varianceDelay,
  varianceFail,
  varianceSettled,
} from './fixtures/variance';

// Variance Phase 02 (render-first, L5/D9): deterministic findings render without waiting for the
// variance pass, session, Turnstile or memory; the pill shows a pending display, never Ready then
// Blocked; a failed or stuck pass ends with a muted line and the pending display goes away.
const ERROR_LINE = 'Changes could not be checked. Errors still work.';

/** Record every gate pill state change (data-gate-state) from now on. */
async function recordGate(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __gateLog: string[] };
    w.__gateLog = [];
    const el = document.querySelector('[data-testid="gate-button"]')!;
    new MutationObserver(() => w.__gateLog.push(el.getAttribute('data-gate-state') ?? '')).observe(
      el,
      { attributes: true, attributeFilter: ['data-gate-state'] },
    );
  });
}
const gateLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gateLog: string[] }).__gateLog);

test.describe('variance-render-first', () => {
  test('should paint errors before the variance pass finishes and never leave the pill pending', async ({
    page,
  }) => {
    const sessions: string[] = [];
    page.on('request', (r) => {
      if (/\/api\/session/.test(r.url())) sessions.push(r.url());
    });
    await gotoApp(page);
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await varianceDelay(page, 3000);
    await recordGate(page);
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2026',
    });
    // errors are painted and usable while the pass is still running
    const gate = page.getByTestId('gate-button');
    await expect(gate).toHaveAttribute('data-variance-pending', 'true');
    await expect(errorRows(page).first()).toBeVisible();
    await expect(changeRows(page)).toHaveCount(0);
    await expect(gate).toContainText('Checking changes');
    await errorRows(page).first().click();
    await expect(page.getByTestId('finding-body')).toBeVisible();
    // then the pass lands: change rows appear and the pending display ends
    await varianceSettled(page);
    await expect(changeRows(page).first()).toBeVisible();
    await expect(gate).not.toContainText('Checking changes');
    const log = await gateLog(page);
    // never Ready then Blocked during the open
    const firstReady = log.indexOf('ready');
    expect(firstReady === -1 || !log.slice(firstReady).includes('blocked')).toBe(true);
    expect(sessions).toEqual([]);
  });

  test('a failed pass shows the muted line, errors keep working and the pill leaves pending', async ({
    page,
  }) => {
    await gotoApp(page);
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await varianceFail(page, true);
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2026',
    });
    await varianceSettled(page);
    await expect(page.getByTestId('variance-line')).toHaveText(ERROR_LINE);
    await expect(changeRows(page)).toHaveCount(0);
    await expect(errorRows(page).first()).toBeVisible();
    await expect(page.getByTestId('gate-button')).not.toContainText('Checking changes');
  });

  test('a stuck pass ends pending by the named timeout', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoApp(page);
    await uploadOne(page, rawFile(NGI_2024, 'ngi-2024.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2024',
    });
    await varianceSettled(page);
    await varianceDelay(page, 60_000);
    await uploadOne(page, rawFile(NGI_2026, 'ngi-2026.htm'), {
      firm: 'Firm X',
      fund: 'NGI',
      version: '2026',
    });
    await expect(page.getByTestId('gate-button')).toHaveAttribute('data-variance-pending', 'true');
    await expect(errorRows(page).first()).toBeVisible();
    await expect(page.getByTestId('variance-line')).toHaveText(ERROR_LINE, { timeout: 40_000 });
    await expect(page.getByTestId('gate-button')).toHaveAttribute('data-variance-pending', 'false');
  });
});
