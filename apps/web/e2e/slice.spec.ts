import { expect, test, type Request } from '@playwright/test';

// Milestone 1 slice (Phase 04a, `stack` project): the production SPA build served by the Worker.
// Uses only Phase 03's published data-testids (plus the `open-another` / `loading-state` hooks the
// Phase 03 fixtures already rely on). No e2e-only hooks: this runs against the real build, locally
// (wrangler dev) or live (SLICE_BASE_URL=https://... with --project=stack).

test.describe('M1 slice through the Worker', () => {
  test('sample #1: real findings, "this Section 11" highlighted, dismiss with reason, gate, quota', async ({
    page,
    request,
  }) => {
    const outbound: string[] = [];
    const consoleErrors: string[] = [];
    const failedPosts: string[] = [];
    page.on('request', (r: Request) => {
      if (/openrouter\.ai|api\.openai\.com/i.test(r.url())) outbound.push(r.url());
    });
    // G16: with the site key compiled in and no Turnstile token, the client must not issue a
    // failing POST (e.g. /api/session); any 4xx/5xx POST is a defect, never filtered away.
    page.on('response', (r) => {
      if (r.request().method() === 'POST' && r.status() >= 400)
        failedPosts.push(`${r.status()} ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.goto('/');
    await expect(page.getByTestId('app-shell')).toBeVisible();

    // Open bundled sample #1 through the Open a document dialog.
    await page.getByTestId('doc-switcher').click();
    await page.getByTestId('open-another').click();
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    await page.locator('[data-testid="sample-option"][data-sample-id="01"]').click();
    await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done/, {
      timeout: 30_000,
    });
    await expect(page.getByTestId('loading-state')).toHaveCount(0);

    // Real engine findings, including the "this Section 11" mismatch, highlighted in the document.
    const rows = page.getByTestId('finding-row');
    await expect(rows.first()).toBeVisible();
    const target = rows.filter({ hasText: 'this Section 11' }).first();
    await expect(target).toBeVisible();
    const id = (await target.getAttribute('data-finding-id'))!;
    expect(id).toBeTruthy();
    await target.click();
    await expect(target).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('finding-found')).toHaveText('this Section 11');
    const mark = page.locator(`[data-testid="doc-highlight"][data-finding-id="${id}"]`).first();
    await expect(mark).toBeInViewport();
    await expect(mark).toContainText(/Section 11/);

    // Triage: dismiss with a reason; the finding leaves the open list and the gate/meta follow.
    const metaBefore = (await page.getByTestId('findings-meta').textContent()) ?? '';
    const openBefore = Number(/(\d+) open/.exec(metaBefore)?.[1]);
    expect(openBefore).toBeGreaterThan(0);
    await page.getByTestId('action-dismiss').click();
    await expect(page.getByTestId('dismiss-modal')).toBeVisible();
    await page.locator('[data-testid="dismiss-reason"][value="tool_false_alarm"]').check();
    await page.getByTestId('dismiss-save').click();
    await expect(page.getByTestId('dismiss-modal')).toBeHidden();
    await expect(page.locator(`[data-testid="finding-row"][data-finding-id="${id}"]`)).toHaveCount(
      0,
    );
    await expect(page.getByTestId('findings-meta')).toContainText(`${openBefore - 1} open`);
    // Sample #1 findings are "Fix before build" (not blocking): the gate pill reads Ready.
    const blocks = Number(/(\d+) block/.exec(metaBefore)?.[1] ?? '0');
    if (blocks === 0) await expect(page.getByTestId('gate-button')).toHaveText(/Ready to digitize/);
    else await expect(page.getByTestId('gate-button')).toHaveText(/Blocked/);

    // /api/quota answers via the Worker. Local (SLICE_BASE_URL unset, no D1): fail-closed, false.
    // Live (SLICE_BASE_URL set, real D1): a boolean; the observed value is recorded.
    const q = await request.get('/api/quota', { headers: { 'x-aduin-client': '1' } });
    expect(q.status()).toBe(200);
    expect(q.headers()['cache-control']).toBe('no-store');
    const body = (await q.json()) as { global_ok: unknown; ai: unknown; ocr_pages: unknown };
    if (process.env.SLICE_BASE_URL) {
      expect(typeof body.global_ok).toBe('boolean');
      test.info().annotations.push({ type: 'global_ok', description: String(body.global_ok) });
      console.log(`[slice] live global_ok=${String(body.global_ok)}`);
    } else {
      expect(body.global_ok).toBe(false);
    }
    expect(body.ai).toBeTruthy();
    expect(body.ocr_pages).toBeTruthy();

    expect(outbound, 'no browser request to an AI provider').toEqual([]);
    expect(failedPosts, 'no failing POST (G16)').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
  });
});
