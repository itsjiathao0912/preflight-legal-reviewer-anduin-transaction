import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, rowsLoc, sample } from './fixtures/app';
import { demoSeed, installFakeWorker, useFakeWorkerClient } from './fixtures/memory-stub-rules';

// Phase 10 EVL fix: opening a firm sample must render deterministic findings without waiting for
// the Turnstile-gated memory session. The spec registers the e2e site key, stubs the Turnstile
// script so it never yields a token, opens firm sample #5 with AI on (firm rules + memory lookup
// both sit behind the session) and checks: findings within 5 s, memory shown unavailable/new, no
// POST /api/session (E24) and no interactive challenge popped from the automatic open.

const SITE_KEY = '1x00000000000000000000AA';

async function stubTurnstile(page: Page, mode: 'never' | 'interactive') {
  await page.addInitScript((key) => {
    (window as unknown as Record<string, unknown>)['__aduinTurnstileSiteKey'] = key;
  }, SITE_KEY);
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `(() => {
        const log = (window.__tsLog = { executes: 0 });
        let opts = null;
        window.turnstile = {
          render(el, o) { opts = o; return 'w1'; },
          execute() {
            log.executes++;
            ${mode === 'interactive' ? "setTimeout(() => opts['before-interactive-callback'](), 10);" : ''}
          },
          reset() {},
        };
      })();`,
    }),
  );
}

async function openFirmSample(page: Page, id: string): Promise<number> {
  await openDialog(page);
  const t0 = Date.now();
  await sample(page, id).click();
  await expect(rowsLoc(page).first()).toBeVisible({ timeout: 5_000 });
  return Date.now() - t0;
}

for (const mode of ['never', 'interactive'] as const) {
  test(`firm sample renders findings without a Turnstile token (${mode})`, async ({ page }) => {
    await stubTurnstile(page, mode);
    const fw = await installFakeWorker(page, demoSeed());
    await gotoApp(page);
    await useFakeWorkerClient(page);
    const ms = await openFirmSample(page, '05');
    expect(ms).toBeLessThan(5_000);
    await expect(page.getByTestId('loading-state')).toHaveCount(0);
    if (mode === 'interactive') {
      // the automatic open never shows the challenge; memory degrades to unavailable
      await expect(page.getByTestId('memory-unavailable')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#aduin-turnstile[role="dialog"]')).toHaveCount(0);
    }
    await page.waitForTimeout(300);
    expect(fw.callsTo('POST', /^\/api\/session$/)).toHaveLength(0);
  });
}
