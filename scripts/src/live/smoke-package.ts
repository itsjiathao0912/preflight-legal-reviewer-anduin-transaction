// `pnpm --filter @aduin/scripts smoke:live-package` — read-only live smoke of the fund package
// demo flow (Intake Phase 4, B4).
//
// One headless Chromium context against the allow-listed workers.dev origin. Every `/api/ai` and
// `/api/ocr` request is aborted and counted (none may be fulfilled). It opens the demo package
// (`northgate-iii` when `/samples/packages.json` lists it, else `hartwell`), sets each row to the
// answer key in `fixtures/package/expected.json`, confirms, runs, and asserts within 5 s of Run:
// findings rows, the coverage line, the Structure `Package` tab, the Counsel GP group (count and
// labels from expected.json) and one DOCX download. Then sample #3 must show no package UI.
// Fails on any 4xx/5xx POST, any console error and any fulfilled AI/OCR call (no filtering).
//
// Flags: --base <origin>, --out <dir> (writes smoke-package-result.json; must exist or be creatable).
// Exit:  0 pass, 1 fail, 2 bad arguments. The result JSON lists request methods and URLs only.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveBase, LiveGuardError, log, parseFlags, ROOT } from './common';

const P = 'smoke:live-package';
export const RUN_BUDGET_MS = 5_000;
export const PREFERRED = 'northgate-iii';
export const FALLBACK = 'hartwell';

export interface FileSpec {
  type: string;
  finalRole: string;
}

export interface PackageExpectation {
  id: string;
  files: Record<string, FileSpec>;
  requests: string[];
  /** Exact coverage line when expected.json records one (hartwell); otherwise prefix-only. */
  coverageLine?: string;
}

interface ExpectedJson {
  hartwell: { files: Record<string, FileSpec>; requests: string[]; coverageLine?: string };
  design: Record<
    string,
    { files: Record<string, FileSpec>; requests: string[]; coverageLine?: string }
  >;
}

/** The package to open: northgate-iii when listed AND described in expected.json, else hartwell. */
export function choosePackage(listed: readonly string[], expected: ExpectedJson): string {
  if (listed.includes(PREFERRED) && expected.design[PREFERRED]) return PREFERRED;
  if (!listed.includes(FALLBACK))
    throw new LiveGuardError('neither northgate-iii nor hartwell is listed');
  return FALLBACK;
}

export function expectationFor(id: string, expected: ExpectedJson): PackageExpectation {
  const e = id === FALLBACK ? expected.hartwell : expected.design[id];
  if (!e || !Array.isArray(e.requests) || !e.files)
    throw new LiveGuardError(`expected.json has no entry for ${id}`);
  return {
    id,
    files: e.files,
    requests: e.requests,
    ...(e.coverageLine ? { coverageLine: e.coverageLine } : {}),
  };
}

/** True when the request must be aborted (AI and OCR on the live origin). */
export function mustAbort(url: string, base: string): boolean {
  const u = new URL(url);
  return u.origin === base && /^\/api\/(ai|ocr)(\/|$)/.test(u.pathname);
}

/** Origin of a console message source (never the path: third-party frame paths can carry keys). */
export function frameOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '(no url)';
  }
}

export interface RecordedRequest {
  method: string;
  url: string;
  status?: number;
  aborted?: boolean;
}

/** Records every request (method and URL only, never bodies, cookies or document text). */
export class RequestRecorder {
  readonly requests: RecordedRequest[] = [];
  readonly consoleErrors: string[] = [];
  aborted = 0;
  fulfilledAiOcr = 0;

  constructor(private readonly base: string) {}

  /** Same-origin URLs are kept; third-party URLs keep only their origin (paths can carry keys). */
  private shown(url: string): string {
    const o = frameOrigin(url);
    return o === this.base ? url : o;
  }

  onRequest(method: string, url: string): RecordedRequest {
    const r = { method: method.toUpperCase(), url: this.shown(url) };
    this.requests.push(r);
    return r;
  }

  onAbort(r: RecordedRequest): void {
    r.aborted = true;
    this.aborted++;
  }

  onResponse(method: string, rawUrl: string, status: number): void {
    const url = this.shown(rawUrl);
    const r = [...this.requests]
      .reverse()
      .find((x) => x.url === url && x.method === method.toUpperCase() && x.status === undefined);
    if (r) r.status = status;
    else this.requests.push({ method: method.toUpperCase(), url, status });
    if (mustAbort(rawUrl, this.base)) this.fulfilledAiOcr++;
  }

  onConsoleError(text: string): void {
    this.consoleErrors.push(text.slice(0, 300));
  }

  failingPosts(): string[] {
    return this.requests
      .filter((r) => r.method === 'POST' && r.status !== undefined && r.status >= 400)
      .map((r) => `${r.status} ${r.url}`);
  }
}

export interface SmokeResult {
  base: string;
  package: string;
  checks: Record<string, boolean>;
  notes: string[];
  failingPosts: string[];
  consoleErrors: string[];
  abortedAiOcr: number;
  fulfilledAiOcr: number;
  runToFindingsMs?: number;
  coverageText?: string;
  requests: RecordedRequest[];
}

/** Pass only when every check is true, nothing failed and no AI/OCR call was fulfilled. */
export function classify(
  r: Pick<SmokeResult, 'checks' | 'failingPosts' | 'consoleErrors' | 'fulfilledAiOcr'>,
): 'pass' | 'fail' {
  const checks = Object.values(r.checks);
  if (checks.length === 0 || checks.some((c) => !c)) return 'fail';
  if (r.failingPosts.length || r.consoleErrors.length || r.fulfilledAiOcr > 0) return 'fail';
  return 'pass';
}

export function exitCodeFor(outcome: 'pass' | 'fail' | 'bad-args'): 0 | 1 | 2 {
  return outcome === 'pass' ? 0 : outcome === 'fail' ? 1 : 2;
}

function readExpected(): ExpectedJson {
  return JSON.parse(
    readFileSync(join(ROOT, 'fixtures', 'package', 'expected.json'), 'utf8'),
  ) as ExpectedJson;
}

async function run(base: string, outDir: string | undefined): Promise<SmokeResult> {
  const { chromium, expect } = await import('@playwright/test');
  const expected = readExpected();
  const rec = new RequestRecorder(base);
  const checks: Record<string, boolean> = {};
  const notes: string[] = [];
  const result: SmokeResult = {
    base,
    package: '',
    checks,
    notes,
    failingPosts: [],
    consoleErrors: rec.consoleErrors,
    abortedAiOcr: 0,
    fulfilledAiOcr: 0,
    requests: rec.requests,
  };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks[name] = true;
    } catch (e) {
      checks[name] = false;
      notes.push(`${name}: ${(e as Error).message.split('\n')[0]?.slice(0, 300)}`);
      throw e;
    }
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    });
    await context.route('**/*', async (route) => {
      const req = route.request();
      if (mustAbort(req.url(), base)) {
        const r = rec.requests.find(
          (x) => x.url === req.url() && !x.aborted && x.status === undefined,
        );
        if (r) rec.onAbort(r);
        else rec.onAbort(rec.onRequest(req.method(), req.url()));
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    page.on('request', (r) => {
      if (!mustAbort(r.url(), base)) rec.onRequest(r.method(), r.url());
    });
    page.on('response', (r) => rec.onResponse(r.request().method(), r.url(), r.status()));
    page.on('console', (m) => {
      if (m.type() === 'error')
        rec.onConsoleError(`${m.text()} [from ${frameOrigin(m.location().url)}]`);
    });
    page.on('pageerror', (e) => rec.onConsoleError(`pageerror: ${e.message}`));

    try {
      await step('app-shell', async () => {
        await page.goto(`${base}/`);
        await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 30_000 });
      });
      const listRes = await page.request.get(`${base}/samples/packages.json`);
      const listed = ((await listRes.json()) as { packages: { id: string }[] }).packages.map(
        (p) => p.id,
      );
      const id = choosePackage(listed, expected);
      const exp = expectationFor(id, expected);
      result.package = id;
      log(P, `package ${id} (${exp.requests.length} GP requests expected)`);

      await step('package-confirm-and-run', async () => {
        await page.getByTestId('doc-switcher').click();
        await page.getByTestId('open-another').click();
        await expect(page.getByTestId('open-document-dialog')).toBeVisible();
        await page
          .locator(`[data-testid="package-sample-option"][data-package-id="${id}"]`)
          .click();
        const rows = page.getByTestId('package-row');
        await expect(rows.first()).toBeVisible({ timeout: 60_000 });
        for (const [name, f] of Object.entries(exp.files)) {
          const r = rows.filter({ hasText: name });
          await r.getByTestId('package-row-type').selectOption(f.type);
          await r.getByTestId('package-row-role').selectOption(f.finalRole);
        }
        const boxes = page.getByTestId('package-row-confirm');
        const n = await boxes.count();
        for (let i = 0; i < n; i++)
          if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
        const version = page.getByTestId('package-version-input');
        if (!(await version.inputValue())) await version.fill('v1');
        await expect(page.getByTestId('package-run')).toBeEnabled();
      });

      await step('findings-within-5s', async () => {
        const t0 = Date.now();
        await page.getByTestId('package-run').click();
        await expect(page.getByTestId('finding-row').first()).toBeVisible({
          timeout: RUN_BUDGET_MS,
        });
        result.runToFindingsMs = Date.now() - t0;
        await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
          timeout: 30_000,
        });
      });

      await step('coverage-line', async () => {
        const line = page.getByTestId('findings-coverage-line');
        await expect(line).toBeVisible();
        if (exp.coverageLine) await expect(line).toHaveText(exp.coverageLine);
        else await expect(line).toHaveText(/^Coverage: /);
        result.coverageText = ((await line.textContent()) ?? '').trim();
      });

      await step('structure-package-tab', async () => {
        await page.getByTestId('nav-structure').click();
        await expect(page.getByTestId('structure-lens-package')).toBeVisible();
        await page.getByTestId('structure-lens-package').click();
        await expect(page.getByTestId('package-lens')).toBeVisible();
      });

      await step('counsel-gp-group', async () => {
        await page.getByTestId('nav-counsel').click();
        await expect(page.getByTestId('counsel-view')).toBeVisible();
        const group = page.getByTestId('gp-group');
        await expect(group).toBeVisible();
        const items = group.getByTestId('gp-request-item');
        await expect(items).toHaveCount(exp.requests.length);
        for (const label of exp.requests)
          await expect(items.filter({ hasText: label }).first()).toBeVisible();
      });

      await step('gp-request-docx', async () => {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15_000 }),
          page.getByTestId('gp-request-export').click(),
        ]);
        if (!/\.docx$/.test(download.suggestedFilename()))
          throw new Error(`unexpected download ${download.suggestedFilename()}`);
        await download.delete();
      });

      await step('sample-03-no-package-ui', async () => {
        await page.getByTestId('nav-findings').click();
        await page.getByTestId('doc-switcher').click();
        await page.getByTestId('open-another').click();
        await expect(page.getByTestId('open-document-dialog')).toBeVisible();
        await page.locator('[data-testid="sample-option"][data-sample-id="03"]').click();
        await expect(page.getByTestId('stage-status-button')).toContainText(/Checks done/, {
          timeout: 30_000,
        });
        await expect(page.getByTestId('finding-row').first()).toBeVisible();
        await expect(page.getByTestId('findings-coverage-line')).toHaveCount(0);
        await expect(page.getByTestId('gp-group')).toHaveCount(0);
        await page.getByTestId('nav-structure').click();
        await expect(page.getByTestId('structure-view')).toBeVisible();
        await expect(page.getByTestId('structure-lens-package')).toHaveCount(0);
      });
      await page.waitForTimeout(1_500); // let trailing requests settle before classifying
    } catch {
      // the failed step is recorded in checks/notes; classification below reports it
    }
  } finally {
    await browser.close();
  }
  result.failingPosts = rec.failingPosts();
  result.abortedAiOcr = rec.aborted;
  result.fulfilledAiOcr = rec.fulfilledAiOcr;
  if (outDir) {
    const dir = resolve(outDir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'smoke-package-result.json'),
      JSON.stringify({ ...result, outcome: classify(result) }, null, 2) + '\n',
    );
  }
  return result;
}

async function main(): Promise<number> {
  let base: string;
  let out: string | undefined;
  try {
    const f = parseFlags(process.argv.slice(2), ['base', 'out'], []);
    base = liveBase(f.values['base']);
    out = f.values['out'];
  } catch (e) {
    log(P, `bad arguments: ${(e as Error).message}`);
    return exitCodeFor('bad-args');
  }
  const r = await run(base, out);
  const outcome = classify(r);
  log(P, `package=${r.package} checks=${JSON.stringify(r.checks)}`);
  log(
    P,
    `runToFindingsMs=${r.runToFindingsMs ?? 'n/a'} coverage=${JSON.stringify(r.coverageText ?? '')}`,
  );
  log(
    P,
    `requests=${r.requests.length} failingPosts=${r.failingPosts.length} consoleErrors=${r.consoleErrors.length} abortedAiOcr=${r.abortedAiOcr} fulfilledAiOcr=${r.fulfilledAiOcr}`,
  );
  for (const n of r.notes) log(P, `note ${n}`);
  for (const p of r.failingPosts) log(P, `failing POST ${p}`);
  for (const c of r.consoleErrors) log(P, `console error ${c}`);
  log(P, outcome === 'pass' ? 'PASS' : 'FAIL');
  return exitCodeFor(outcome);
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
