// `pnpm --filter @aduin/scripts probe:live-variance` — read-only live probe of the variance demo
// (Variance Phase 05, G2/G2b; the Phase 10 render-first blind spot on the keyed live bundle).
//
// One headless Chromium context against the allow-listed workers.dev origin (`assertLiveBase`). It
// uploads, client-side only through `upload-input` (no document body leaves the browser), the
// authored Hartwell & Crane Fund II then Fund III (firm Hartwell & Crane LLP) and asserts, WITHOUT
// a Turnstile token: findings visible and the 7 change rows (3 new, 4 logic) within the render-first
// budget of Open, no failing `POST /api/session`, no 4xx/5xx first-party response, no first-party
// console error, and no fulfilled `/api/ai` or `/api/ocr` request (both are aborted). Console
// errors from third-party frames (the Cloudflare Turnstile iframe logs its own in headless Chromium,
// backlog `intake-live-smoke-turnstile-console`) are recorded by origin, never failed on.
// One session slot is claimed in the shared ledger before the browser starts (5 per IP per UTC day).
//
// Flags: --base <origin>, --out <abs dir outside the repo> (writes probe-variance-result.json),
//        --timeout-ms <n> (per wait; default 30000).
// Exit:  0 pass, 1 fail, 2 bad arguments or ledger refusal.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertOutsideRepo,
  Ledger,
  liveBase,
  LiveGuardError,
  log,
  parseFlags,
  ROOT,
} from './common';
import { frameOrigin, mustAbort, RequestRecorder } from './smoke-package';

const P = 'probe:live-variance';
/** Render-first budget: findings and the changes paint within 5 s of Open (deterministic target). */
export const RENDER_BUDGET_MS = 5_000;
export const FIRM = 'Hartwell & Crane LLP';
export const HC_DIR = join(ROOT, 'fixtures', 'variance', 'hartwell-crane');
export const EXPECTED_FILE = join(ROOT, 'fixtures', 'variance', 'expected', 'hartwell-crane.json');

export interface DemoExpectation {
  shown: number;
  new: number;
  changedLogic: number;
}

/** Pinned demo numbers from the authored expected file (never read back from the engine). */
export function demoExpectation(file = EXPECTED_FILE): DemoExpectation {
  const j = JSON.parse(readFileSync(file, 'utf8')) as {
    shown: number;
    new: number;
    changed_logic: number;
  };
  return { shown: j.shown, new: j.new, changedLogic: j.changed_logic };
}

export interface VarianceObservation {
  base: string;
  /** ms from the Fund III Open click to the first painted finding row (null = never). */
  findingsMs: number | null;
  /** ms from the Fund III Open click to the expected number of change rows (null = never). */
  changesMs: number | null;
  changeRows: number;
  newRows: number;
  logicRows: number;
  sessionPostStatus: number | null;
  failingFirstParty: string[];
  firstPartyConsoleErrors: string[];
  thirdPartyConsoleErrors: string[];
  abortedAiOcr: number;
  fulfilledAiOcr: number;
}

/** A console message is first-party when it comes from the live origin (or carries no source). */
export function isFirstParty(sourceUrl: string, base: string): boolean {
  const o = frameOrigin(sourceUrl);
  return o === base || o === '(no url)' || sourceUrl === '';
}

export function judge(
  o: VarianceObservation,
  exp: DemoExpectation,
): { verdict: 'pass' | 'fail'; reasons: string[] } {
  const reasons: string[] = [];
  if (o.changeRows !== exp.shown)
    reasons.push(`change rows ${o.changeRows}, expected ${exp.shown}`);
  if (o.newRows !== exp.new) reasons.push(`new rows ${o.newRows}, expected ${exp.new}`);
  if (o.logicRows !== exp.changedLogic)
    reasons.push(`logic rows ${o.logicRows}, expected ${exp.changedLogic}`);
  if (o.findingsMs === null) reasons.push('findings never painted');
  else if (o.findingsMs > RENDER_BUDGET_MS)
    reasons.push(`findings painted after ${o.findingsMs} ms (budget ${RENDER_BUDGET_MS})`);
  if (o.changesMs === null) reasons.push('changes never painted');
  else if (o.changesMs > RENDER_BUDGET_MS)
    reasons.push(`changes painted after ${o.changesMs} ms (budget ${RENDER_BUDGET_MS})`);
  if (o.sessionPostStatus !== null && o.sessionPostStatus >= 400)
    reasons.push(`POST /api/session answered ${o.sessionPostStatus}`);
  if (o.failingFirstParty.length)
    reasons.push(`failing first-party responses: ${o.failingFirstParty.join(', ')}`);
  if (o.firstPartyConsoleErrors.length)
    reasons.push(`${o.firstPartyConsoleErrors.length} first-party console error(s)`);
  if (o.fulfilledAiOcr > 0) reasons.push(`${o.fulfilledAiOcr} AI/OCR request(s) were fulfilled`);
  return { verdict: reasons.length ? 'fail' : 'pass', reasons };
}

async function probe(base: string, timeoutMs: number, exp: DemoExpectation) {
  const { chromium, expect } = await import('@playwright/test');
  const rec = new RequestRecorder(base);
  const obs: VarianceObservation = {
    base,
    findingsMs: null,
    changesMs: null,
    changeRows: 0,
    newRows: 0,
    logicRows: 0,
    sessionPostStatus: null,
    failingFirstParty: [],
    firstPartyConsoleErrors: [],
    thirdPartyConsoleErrors: [],
    abortedAiOcr: 0,
    fulfilledAiOcr: 0,
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.route('**/*', async (route) => {
      const req = route.request();
      if (mustAbort(req.url(), base)) {
        rec.onAbort(rec.onRequest(req.method(), req.url()));
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on('request', (r) => {
      if (!mustAbort(r.url(), base)) rec.onRequest(r.method(), r.url());
    });
    page.on('response', (r) => {
      const method = r.request().method();
      rec.onResponse(method, r.url(), r.status());
      const u = new URL(r.url());
      if (u.origin !== base) return;
      if (method === 'POST' && u.pathname === '/api/session') obs.sessionPostStatus = r.status();
      if (r.status() >= 400) obs.failingFirstParty.push(`${r.status()} ${method} ${u.pathname}`);
    });
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const src = m.location().url;
      if (isFirstParty(src, base)) obs.firstPartyConsoleErrors.push(m.text().slice(0, 300));
      else obs.thirdPartyConsoleErrors.push(frameOrigin(src));
    });
    page.on('pageerror', (e) => obs.firstPartyConsoleErrors.push(`pageerror: ${e.message}`));

    const upload = async (file: string, fund: string) => {
      if (!(await page.getByTestId('open-document-dialog').isVisible())) {
        await page.getByTestId('doc-switcher').click();
        await page.getByTestId('open-another').click();
      }
      await page.getByTestId('upload-input').setInputFiles({
        name: file,
        mimeType: 'text/html',
        buffer: readFileSync(join(HC_DIR, file)),
      });
      await page.getByTestId('firm-combobox').fill(FIRM);
      await page.getByTestId('fund-input').fill(fund);
      await page.getByTestId('privacy-ack').check();
      const t0 = Date.now();
      await page.getByTestId('open-submit').click();
      // Wait for the Open dialog to close before the caller reads state; the
      // previous document's state otherwise satisfies the next assertion early.
      await expect(page.getByTestId('open-document-dialog')).toBeHidden({ timeout: timeoutMs });
      return t0;
    };

    await page.goto(`${base}/`);
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: timeoutMs });
    await upload('fund-II.html', 'Fund II');
    await expect(page.getByTestId('gate-button')).toHaveAttribute(
      'data-variance-pending',
      'false',
      {
        timeout: timeoutMs,
      },
    );
    const t0 = await upload('fund-III.html', 'Fund III');
    const changes = page.locator('[data-testid="finding-row"][data-kind="change"]');
    await page
      .getByTestId('finding-row')
      .first()
      .waitFor({ timeout: timeoutMs })
      .then(() => (obs.findingsMs = Date.now() - t0))
      .catch(() => undefined);
    await expect(changes)
      .toHaveCount(exp.shown, { timeout: timeoutMs })
      .then(() => (obs.changesMs = Date.now() - t0))
      .catch(() => undefined);
    obs.changeRows = await changes.count();
    obs.newRows = await changes.and(page.locator('[data-change-type="new"]')).count();
    obs.logicRows = await changes.and(page.locator('[data-change-type="changed_logic"]')).count();
  } finally {
    await browser.close();
  }
  obs.abortedAiOcr = rec.aborted;
  obs.fulfilledAiOcr = rec.fulfilledAiOcr;
  return obs;
}

async function main(): Promise<number> {
  const f = parseFlags(process.argv.slice(2), ['base', 'out', 'timeout-ms'], []);
  const base = liveBase(f.values['base']);
  const timeoutMs = Number(f.values['timeout-ms'] ?? 30_000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new LiveGuardError('bad --timeout-ms');
  const out = f.values['out'] ? assertOutsideRepo(f.values['out']) : null;
  const exp = demoExpectation();
  new Ledger().claim('session', 'probe:live-variance headless');
  const o = await probe(base, timeoutMs, exp);
  const { verdict, reasons } = judge(o, exp);
  log(
    P,
    `findings=${o.findingsMs ?? '-'} ms changes=${o.changesMs ?? '-'} ms rows=${o.changeRows} (new ${o.newRows}, logic ${o.logicRows}) session=${o.sessionPostStatus ?? 'none'} abortedAiOcr=${o.abortedAiOcr} fulfilledAiOcr=${o.fulfilledAiOcr} thirdPartyConsole=${o.thirdPartyConsoleErrors.length}`,
  );
  for (const r of reasons) log(P, `reason: ${r}`);
  if (out) {
    mkdirSync(out, { recursive: true, mode: 0o700 });
    writeFileSync(
      join(out, 'probe-variance-result.json'),
      JSON.stringify({ verdict, reasons, ...o }, null, 2) + '\n',
      { mode: 0o600 },
    );
  }
  log(P, verdict === 'pass' ? 'PASS' : 'FAIL');
  return verdict === 'pass' ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      log(P, `error: ${(e as Error).message}`);
      process.exit(e instanceof LiveGuardError ? 2 : 1);
    },
  );
}
