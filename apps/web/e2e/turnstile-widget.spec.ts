import { expect, test, type Page } from '@playwright/test';
import { gotoApp } from './fixtures/app';
import { demoSeed, installFakeWorker, useFakeWorkerClient } from './fixtures/memory-stub-rules';

// Phase 10 D1 (AC39 client leg, AC31): the Turnstile widget. The `--mode e2e` bundle has no site
// key, so the spec sets the IS_E2E-only window global before load and stubs the Cloudflare script
// with page.route (no real challenge, no network). The stub API records render options and answers
// `execute` with a token (or an error), so the spec proves registration, lazy load, managed
// execute mode, reset after use, the token on POST /api/session, and E24 (no token = no request).

const SITE_KEY = '1x00000000000000000000AA';

async function stubTurnstile(page: Page, outcome: 'token' | 'error') {
  await page.addInitScript((key) => {
    (window as unknown as Record<string, unknown>)['__aduinTurnstileSiteKey'] = key;
  }, SITE_KEY);
  let scriptLoads = 0;
  await page.route('https://challenges.cloudflare.com/**', (route) => {
    scriptLoads++;
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `(() => {
        const log = (window.__tsLog = { renders: [], executes: 0, resets: 0 });
        let opts = null;
        window.turnstile = {
          render(el, o) { opts = o; log.renders.push({ sitekey: o.sitekey, execution: o.execution, hidden: el.closest('[aria-hidden]')?.getAttribute('aria-hidden') ?? null }); return 'w1'; },
          execute() {
            log.executes++;
            setTimeout(() => ${outcome === 'token' ? "opts.callback('e2e-token-' + log.executes)" : "opts['error-callback']('110200')"}, 10);
          },
          reset() { log.resets++; },
        };
      })();`,
    });
  });
  return { scriptLoads: () => scriptLoads };
}

async function sessionHeaders(page: Page): Promise<(string | undefined)[]> {
  const seen: (string | undefined)[] = [];
  await page.route('**/api/session', async (route, req) => {
    seen.push(req.headers()['x-aduin-turnstile']);
    await route.fallback();
  });
  return seen;
}

async function gotoMemory(page: Page) {
  await page.getByTestId('nav-memory').click();
  await expect(page.getByTestId('memory-view')).toBeVisible();
}

test.describe('turnstile-widget', () => {
  test('loads lazily and sends a fresh token on POST /api/session with the analyst name', async ({
    page,
  }) => {
    const ts = await stubTurnstile(page, 'token');
    const fw = await installFakeWorker(page, demoSeed());
    const headers = await sessionHeaders(page);
    await gotoApp(page);
    // registered but lazy: no script until the first token request
    expect(ts.scriptLoads()).toBe(0);
    await useFakeWorkerClient(page);
    await page.getByTestId('ai-off').click();

    // analyst-name flow: the session is bootstrapped with the edited name
    await page.getByTestId('analyst-name-edit').click();
    await page.getByTestId('analyst-name-input').fill('Minh Anh Nguyen');
    await page.getByTestId('analyst-name-input').press('Enter');
    await expect(page.getByTestId('analyst-name')).toHaveText('Minh Anh Nguyen');

    await gotoMemory(page);
    await expect.poll(() => fw.callsTo('POST', /^\/api\/session$/).length).toBeGreaterThan(0);
    const session = fw.callsTo('POST', /^\/api\/session$/)[0]!;
    expect((session.body as { analyst_name: string }).analyst_name).toBe('Minh Anh Nguyen');
    expect(headers[0]).toBe('e2e-token-1');
    expect(ts.scriptLoads()).toBe(1);

    const log = await page.evaluate(
      () =>
        (window as unknown as { __tsLog: { renders: unknown[]; executes: number; resets: number } })
          .__tsLog,
    );
    expect(log.renders).toEqual([{ sitekey: SITE_KEY, execution: 'execute', hidden: 'true' }]);
    expect(log.resets).toBe(log.executes);
    fw.expectClean();
  });

  test('no token from the widget: no POST /api/session is sent (E24)', async ({ page }) => {
    await stubTurnstile(page, 'error');
    const fw = await installFakeWorker(page, demoSeed());
    await gotoApp(page);
    await useFakeWorkerClient(page);
    await page.getByTestId('ai-off').click();
    // a name edit re-bootstraps the session (Memory alone with no firm document never does)
    await page.getByTestId('analyst-name-edit').click();
    await page.getByTestId('analyst-name-input').fill('Minh Anh Nguyen');
    await page.getByTestId('analyst-name-input').press('Enter');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __tsLog?: { executes: number } }).__tsLog?.executes ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    // give a wrongly-issued request time to show up
    await page.waitForTimeout(300);
    expect(fw.callsTo('POST', /^\/api\/session$/)).toHaveLength(0);
  });
});
