import type { ConsoleMessage, Request } from '@playwright/test';
import { CLIENT_HEADERS, expect, stackHome, test } from './fixtures/stack-memory';

/**
 * Intake Phase 4 B3 (AC58 on the package flow, `stack-memory` project): with in-spec HTML members
 * that carry unique sentinel sentences, the package flow (tagged firm) on the seeded local stack
 * sends only session, memory and quota API calls plus static assets; no URL or body contains the
 * sentinel or any member text; zero 4xx/5xx POST responses and zero console errors (no ignore
 * lists: the pre-deploy rehearsal of `smoke:live-package`). The health route still reports
 * schema version 5. Observe only; no request is filtered or rewritten.
 */
const SENTINEL_A = `Zephyrine quartz lantern ${Date.now().toString(36)} alpha sentence.`;
const SENTINEL_B = `Obsidian marigold harbor ${Date.now().toString(36)} beta sentence.`;

const SUB = `<!doctype html><html><head><title>Subscription Agreement</title></head><body>
<h1>SUBSCRIPTION AGREEMENT</h1>
<p>Privacy Harbor Fund I, L.P. Subscription Agreement for Limited Partner Interests.</p>
<h2>Section 1. Subscription</h2>
<p>The undersigned Investor hereby subscribes for a Capital Commitment in the Partnership. ${SENTINEL_A}</p>
<p>Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.</p>
<h2>Section 2. Representations of the Investor</h2>
<p>The Investor represents that it is an accredited investor. If the Investor is a Benefit Plan Investor, complete Annex F.</p>
<p>See Section 1 for the amount of the Capital Commitment.</p>
</body></html>`;

const LPA = `<!doctype html><html><head><title>Limited Partnership Agreement</title></head><body>
<h1>AMENDED AND RESTATED LIMITED PARTNERSHIP AGREEMENT</h1>
<h2>Article I. Definitions</h2>
<p>"Capital Commitment" means the amount committed by a Limited Partner to the Partnership. ${SENTINEL_B}</p>
<p>"General Partner" means Privacy Harbor GP, LLC.</p>
</body></html>`;

const MEMBER_SNIPPETS = [
  SENTINEL_A,
  SENTINEL_B,
  'Privacy Harbor Fund I',
  'hereby subscribes for a Capital Commitment',
  'means the amount committed by a Limited Partner',
];

const ALLOWED_API = /^\/api\/(session|memory|quota)(\/|$)/;

test.describe('stack-memory-package-privacy', () => {
  test('should send no document text and no failing POST during the package flow on the seeded stack', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const origin = new URL(baseURL!).origin;
    const seen: { method: string; url: string; body: string }[] = [];
    const failedPosts: string[] = [];
    const consoleErrors: string[] = [];
    page.context().on('request', (r: Request) => {
      seen.push({ method: r.method(), url: r.url(), body: r.postData() ?? '' });
    });
    page.on('response', (r) => {
      if (r.request().method() === 'POST' && r.status() >= 400)
        failedPosts.push(`${r.status()} ${r.url()}`);
    });
    page.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await stackHome(page);
    await page.getByTestId('doc-switcher').click();
    await page.getByTestId('open-another').click();
    await expect(page.getByTestId('open-document-dialog')).toBeVisible();
    await page.getByTestId('upload-input').setInputFiles([
      { name: 'privacy-harbor-sub.html', mimeType: 'text/html', buffer: Buffer.from(SUB) },
      { name: 'privacy-harbor-lpa.html', mimeType: 'text/html', buffer: Buffer.from(LPA) },
    ]);
    await page.getByTestId('firm-combobox').fill('Partners Group AG');
    await page.getByTestId('fund-input').fill('Privacy Harbor Fund I');
    await page.getByTestId('version-input').fill('v1');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();

    const rows = page.getByTestId('package-row');
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    for (const [name, type, role] of [
      ['privacy-harbor-sub.html', 'sub_agreement', 'to_digitize'],
      ['privacy-harbor-lpa.html', 'lpa', 'reference'],
    ] as const) {
      const r = rows.filter({ hasText: name });
      await r.getByTestId('package-row-type').selectOption(type);
      await r.getByTestId('package-row-role').selectOption(role);
      const box = r.getByTestId('package-row-confirm');
      if (!(await box.isChecked())) await box.check();
    }
    const version = page.getByTestId('package-version-input');
    if (!(await version.inputValue())) await version.fill('v1');
    await page.getByTestId('package-run').click();
    await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done/, {
      timeout: 60_000,
    });
    await expect(page.getByTestId('findings-meta')).toBeVisible();
    await expect(page.getByTestId('findings-coverage-line')).toBeVisible();
    await expect(page.getByTestId('findings-column')).not.toHaveAttribute(
      'data-memory-state',
      'pending',
      { timeout: 30_000 },
    );
    await page.getByTestId('nav-counsel').click();
    await expect(page.getByTestId('counsel-view')).toBeVisible();
    await page.waitForTimeout(1_500);

    expect(seen.length).toBeGreaterThan(0);
    const offenders = seen.filter((s) => {
      const u = new URL(s.url);
      if (u.protocol === 'blob:' || u.protocol === 'data:') return false;
      if (u.origin !== origin) return true;
      return u.pathname.startsWith('/api/') && !ALLOWED_API.test(u.pathname);
    });
    expect(
      offenders.map((o) => `${o.method} ${o.url}`),
      'only session, memory, quota API calls and static assets',
    ).toEqual([]);
    for (const s of seen)
      for (const snip of MEMBER_SNIPPETS) {
        expect(s.url.includes(snip), `URL leaks member text: ${s.url}`).toBe(false);
        expect(s.body.includes(snip), `body of ${s.method} ${s.url} leaks member text`).toBe(false);
      }
    expect(failedPosts, 'no failing POST').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);

    const health = await page.request.get('/api/memory/health', { headers: CLIENT_HEADERS });
    expect(health.status()).toBe(200);
    expect(((await health.json()) as { schema_version: string }).schema_version).toBe('5');
  });
});
