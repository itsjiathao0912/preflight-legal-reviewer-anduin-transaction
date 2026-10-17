// `pnpm --filter @aduin/scripts probe:live-session` — real-browser Turnstile session probe (AC31/AC39, G14, G15).
//
// Runs Chromium headless first, then headed (unless --headless-only / --headed-only). Each run:
// claims one session in the ledger BEFORE launching (5 per IP per UTC day; refuses at 4 used),
// installs a `securitypolicyviolation` listener before any page script, opens the live site and
// the #memory view (which bootstraps `POST /api/session` lazily), and waits for that response.
// Pass = a Turnstile token was sent, `POST /api/session` answered 200, zero CSP violations.
// AI and OCR requests are aborted by the probe (no counted calls here).
//
// Cookie handoff (G14): with --cookie-out <abs path outside the repo> the signed workspace cookie
// of the last passing run is written mode 600 for `conformance:free-plan --section burst`; it is
// never printed. Delete it after the burst.
//
// Flags: --base <origin>, --cookie-out <path>, --headless-only, --headed-only, --timeout-ms <n>.
// Env:   LIVE_SCRATCH_DIR (ledger dir; default ~/.cache/aduin-transaction-live).
// Exit:  0 pass, 1 fail, 2 bad args / ledger refusal, 3 residual R2 (no token obtainable).
import { pathToFileURL } from 'node:url';
import {
  COOKIE_NAME,
  Ledger,
  liveBase,
  LiveGuardError,
  log,
  parseFlags,
  writeCookieFile,
} from './common';

const P = 'probe:live-session';

export interface SessionObservation {
  mode: 'headless' | 'headed';
  sessionStatus: number | null;
  tokenSent: boolean;
  violations: string[];
  cookie: string | null;
}

/** True when a session request carried a non-empty Turnstile token (header or JSON body key). */
export function requestCarriesToken(
  headers: Record<string, string>,
  postData: string | null,
): boolean {
  for (const [k, v] of Object.entries(headers)) if (/turnstile/i.test(k) && v.trim()) return true;
  if (!postData) return false;
  try {
    const body = JSON.parse(postData) as Record<string, unknown>;
    return Object.entries(body).some(
      ([k, v]) => /turnstile|token/i.test(k) && typeof v === 'string' && v.length > 0,
    );
  } catch {
    return false;
  }
}

export type Verdict = 'pass' | 'fail' | 'residual';

export function judge(o: SessionObservation): { verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];
  if (o.violations.length)
    reasons.push(`${o.violations.length} securitypolicyviolation(s): ${o.violations.join(' | ')}`);
  if (o.sessionStatus === null && !o.tokenSent) {
    // E24: with a site key and no token the client must not POST at all.
    return {
      verdict: reasons.length ? 'fail' : 'residual',
      reasons: [...reasons, 'no Turnstile token obtained; no session POST (R2)'],
    };
  }
  if (!o.tokenSent) reasons.push('session POST carried no Turnstile token');
  if (o.sessionStatus !== 200)
    reasons.push(`POST /api/session answered ${o.sessionStatus ?? 'nothing'}`);
  if (!o.cookie) reasons.push('no workspace cookie set');
  return { verdict: reasons.length ? 'fail' : 'pass', reasons };
}

/** Init script: collect CSP violations into a page global before any app script runs. */
export const VIOLATION_INIT = `(() => {
  const list = [];
  Object.defineProperty(window, '__aduinCspViolations', { value: list });
  document.addEventListener('securitypolicyviolation', (e) => {
    list.push(String(e.violatedDirective) + ' ' + String(e.blockedURI));
  });
})();`;

async function runOnce(
  base: string,
  headed: boolean,
  timeoutMs: number,
): Promise<SessionObservation> {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: !headed });
  const obs: SessionObservation = {
    mode: headed ? 'headed' : 'headless',
    sessionStatus: null,
    tokenSent: false,
    violations: [],
    cookie: null,
  };
  try {
    const context = await browser.newContext();
    await context.route(/\/api\/(ai|ocr)(\?|$)/, (route) => route.abort());
    const page = await context.newPage();
    await page.addInitScript(VIOLATION_INIT);
    const sessionResp = page
      .waitForResponse(
        (r) => r.url() === `${base}/api/session` && r.request().method() === 'POST',
        { timeout: timeoutMs },
      )
      .then(async (r) => {
        obs.tokenSent = requestCarriesToken(await r.request().allHeaders(), r.request().postData());
        obs.sessionStatus = r.status();
      })
      .catch(() => undefined);
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.evaluate(() => {
      location.hash = '#memory';
    });
    await sessionResp;
    obs.violations = await page.evaluate(() =>
      (
        (window as unknown as { __aduinCspViolations?: string[] }).__aduinCspViolations ?? []
      ).slice(),
    );
    const c = (await context.cookies(base)).find((x) => x.name === COOKIE_NAME);
    obs.cookie = c?.value ?? null;
  } finally {
    await browser.close();
  }
  return obs;
}

async function main(): Promise<number> {
  const f = parseFlags(
    process.argv.slice(2),
    ['base', 'cookie-out', 'timeout-ms'],
    ['headless-only', 'headed-only'],
  );
  const base = liveBase(f.values['base']);
  const timeoutMs = Number(f.values['timeout-ms'] ?? 90_000);
  const modes: boolean[] = f.bools.has('headless-only')
    ? [false]
    : f.bools.has('headed-only')
      ? [true]
      : [false, true];
  const ledger = new Ledger();
  let cookie: string | null = null;
  let worst: Verdict = 'pass';
  for (const headed of modes) {
    ledger.claim('session', `probe:live-session ${headed ? 'headed' : 'headless'}`);
    const o = await runOnce(base, headed, timeoutMs);
    const { verdict, reasons } = judge(o);
    log(
      P,
      `${o.mode}: ${verdict.toUpperCase()} session=${o.sessionStatus ?? '-'} token=${o.tokenSent} violations=${o.violations.length}${reasons.length ? ` (${reasons.join('; ')})` : ''}`,
    );
    if (verdict === 'pass' && o.cookie) cookie = o.cookie;
    if (verdict === 'fail') worst = 'fail';
    else if (verdict === 'residual' && worst === 'pass') worst = 'residual';
  }
  const s = ledger.counts('session');
  log(P, `session ledger: ${s.today} used today (stop at 4 of 5)`);
  const out = f.values['cookie-out'];
  if (out && cookie)
    log(P, `workspace cookie handed over (mode 600): ${writeCookieFile(out, cookie)}`, [cookie]);
  else if (out) log(P, 'no passing session; no cookie handed over (D4 burst becomes residual R2)');
  return worst === 'pass' ? 0 : worst === 'residual' ? 3 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(`${P}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(e instanceof LiveGuardError ? 2 : 1);
    },
  );
}
