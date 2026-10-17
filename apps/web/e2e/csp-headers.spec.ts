import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { blockOpenRouter, enableLane, forbidAi, interceptQuota } from './fixtures/ai';
import { gotoApp, openDialog, openSample } from './fixtures/app';
import { openCompare, pickPair, waitDiff } from './fixtures/compare';
import {
  EXPECT,
  exportDocxText,
  findingByQuote,
  gotoCounsel,
  markCounsel,
  openFund,
} from './fixtures/counsel';

/**
 * csp-headers (AC31, D2 / F10): reads and parses apps/web/public/_headers and injects exactly the
 * headers it declares for `/*` into every app-origin response of the preview server (header-
 * injection shim; `vite preview` does not apply `_headers`), then asserts zero
 * `securitypolicyviolation` events across load, sample open (Radix dialog), scan viewer / PDF
 * render, DOCX export, Compare and outline export.
 *
 * Proxy, not proof: this runs on the `--mode e2e` bundle served by the preview project (same
 * chunking as production). The production-shape proof is live: `curl -sI` on the workers.dev URL,
 * zero console errors in the live smoke, and the violation listener in `probe:live-session`.
 * The real Turnstile iframe under this CSP is only provable live (R4).
 *
 * Report-only trial: `CSP_REPORT_ONLY=1` sends the same policy as
 * `Content-Security-Policy-Report-Only` (violations are still reported, nothing is blocked), so the
 * trial lists every violation in one pass before the policy is enforced.
 */
const HEADERS_FILE = resolve(import.meta.dirname, '..', 'public', '_headers');
const REPORT_ONLY = process.env['CSP_REPORT_ONLY'] === '1';

/** Headers declared for the `/*` rule of a Cloudflare `_headers` file (lower-cased names). */
function headersForAll(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      inAll = raw.trim() === '/*';
      continue;
    }
    const i = raw.indexOf(':');
    if (inAll && i > 0) out[raw.slice(0, i).trim().toLowerCase()] = raw.slice(i + 1).trim();
  }
  return out;
}

const DECLARED = headersForAll(readFileSync(HEADERS_FILE, 'utf8'));
const CSP = DECLARED['content-security-policy'];
const INJECTED: Record<string, string> = { ...DECLARED };
if (REPORT_ONLY && CSP) {
  delete INJECTED['content-security-policy'];
  INJECTED['content-security-policy-report-only'] = CSP;
}

interface Violation {
  directive: string;
  blocked: string;
  source: string;
  sample: string;
}

/** Inject the `_headers` set on app-origin, non-/api responses and record every CSP violation. */
async function installCsp(page: Page): Promise<{ console: string[] }> {
  expect(CSP, '_headers must declare a Content-Security-Policy under /*').toBeTruthy();
  const consoleCsp: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) consoleCsp.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: unknown[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations.push({
        directive: e.effectiveDirective,
        blocked: e.blockedURI,
        source: `${e.sourceFile}:${e.lineNumber}`,
        sample: e.sample,
      });
    });
  });
  // Registered first, so routes added later by a test (API stubs) take precedence.
  await page.route('**/*', async (route, req) => {
    const url = new URL(req.url());
    const base = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:4317');
    if (url.origin !== base.origin || url.pathname.startsWith('/api/')) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...INJECTED } });
  });
  return { console: consoleCsp };
}

async function violations(page: Page): Promise<Violation[]> {
  return page.evaluate(
    () => (window as unknown as { __cspViolations: Violation[] }).__cspViolations,
  );
}

async function expectClean(page: Page, csp: { console: string[] }, step: string) {
  const v = await violations(page);
  if (v.length || csp.console.length)
    console.log(`[csp-trial] ${step}: ${JSON.stringify({ events: v, console: csp.console })}`);
  expect(v, `${step}: securitypolicyviolation events`).toEqual([]);
  expect(csp.console, `${step}: CSP console messages`).toEqual([]);
}

test.describe('csp-headers', () => {
  test('should raise zero securitypolicyviolation events on the bundle under the _headers policy', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const csp = await installCsp(page);
    const res = await page.goto('/');
    expect(
      res?.headers()[
        REPORT_ONLY ? 'content-security-policy-report-only' : 'content-security-policy'
      ],
    ).toBe(CSP);
    expect(res?.headers()['x-content-type-options']).toBe('nosniff');
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await page.waitForFunction(() => '__aduinE2E' in window);
    await expectClean(page, csp, 'load');

    // sample open through the Radix dialog (react-remove-scroll / react-style-singleton)
    await openSample(page, '03');
    await expectClean(page, csp, 'sample open');

    // outline export (Structure view download)
    await page.getByTestId('nav-structure').click();
    await expect(page.getByTestId('structure-view')).toBeVisible();
    await Promise.all([page.waitForEvent('download'), page.getByTestId('outline-export').click()]);
    await expectClean(page, csp, 'outline export');

    // Compare (diff of two bundled samples)
    await openCompare(page);
    await pickPair(page, 'PG NGI 2024', 'PG NGI 2026');
    await waitDiff(page);
    await expectClean(page, csp, 'compare');
  });

  test('should raise zero violations through the DOCX counsel export', async ({ page }) => {
    test.setTimeout(90_000);
    const csp = await installCsp(page);
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const quote = EXPECT.passages.find(
      (p) => p.key === 'n1-new-placeholder' && p.fund === 'fund-II',
    )!.quote;
    await markCounsel(page, findingByQuote('fund-II', quote).id);
    await gotoCounsel(page);
    const { filename } = await exportDocxText(page);
    expect(filename).toMatch(/\.docx$/);
    await expectClean(page, csp, 'docx export');
  });

  test('should raise zero violations rendering a scanned PDF in the scan viewer', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const csp = await installCsp(page);
    const openrouter = await blockOpenRouter(page);
    await forbidAi(page);
    await interceptQuota(page);
    const root = resolve(import.meta.dirname, '..', '..', '..');
    const recorded = JSON.parse(
      readFileSync(
        join(root, 'fixtures', 'llm-recordings', 'ocr', 'appa1-pg1.authored.json'),
        'utf8',
      ),
    ) as { result: unknown };
    await page.route('**/api/ocr', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
        body: `${JSON.stringify({ t: 'result', kind: 'ocr', cache: 'miss', model: 'test', data: recorded.result })}\n`,
      }),
    );
    await gotoApp(page);
    await enableLane(page);
    await openDialog(page);
    await page.getByTestId('upload-input').setInputFiles({
      name: 'scanned.pdf',
      mimeType: 'application/pdf',
      buffer: readFileSync(join(root, 'fixtures', 'pdf', 'scanned.pdf')),
    });
    await page.getByTestId('firm-combobox').fill('Other / no firm');
    await page.getByTestId('fund-input').fill('CSP trial');
    await page.getByTestId('privacy-ack').check();
    await page.getByTestId('open-submit').click();
    await expect(page.getByTestId('doc-pane')).toContainText('Partnership/LLC', {
      timeout: 60_000,
    });
    expect(openrouter).toEqual([]);
    await expectClean(page, csp, 'scan viewer / pdf render');
  });
});
