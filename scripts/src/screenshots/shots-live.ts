// `pnpm --filter @aduin/scripts shots:live` — read-only screenshots of the live site into docs/demo/img/.
//
// One headless Chromium context per run. Read-only by construction: every non-GET request to
// /api/* is aborted (so no AI, no OCR, no session, no memory write), and nothing is typed or
// submitted. Pages are hash views of the SPA.
//
// Flags: --base <origin>, --views <comma list of hash views> (default findings,structure,compare,counsel,memory),
//        --out <dir> (default docs/demo/img), --width <px> (1440), --height <px> (900).
// Exit:  0 all shots written, 1 failure, 2 bad args.
import { mkdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { liveBase, LiveGuardError, log, parseFlags, ROOT } from '../live/common';

const P = 'shots:live';
export const DEFAULT_VIEWS = ['findings', 'structure', 'compare', 'counsel', 'memory'] as const;

export function parseViews(raw: string | undefined): string[] {
  const views = raw
    ? raw
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    : [...DEFAULT_VIEWS];
  for (const v of views)
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(v))
      throw new LiveGuardError(`invalid view name ${JSON.stringify(v)}`);
  return views;
}

/** The read-only policy: true means the request must be aborted. */
export function mustBlock(method: string, url: string, base: string): boolean {
  const u = new URL(url);
  if (u.origin !== base) return false;
  if (!u.pathname.startsWith('/api/')) return false;
  return method.toUpperCase() !== 'GET' || /^\/api\/(ai|ocr|session)$/.test(u.pathname);
}

export function outDir(raw: string | undefined): string {
  const dir = resolve(raw ?? join(ROOT, 'docs', 'demo', 'img'));
  const allowed = resolve(ROOT, 'docs', 'demo');
  if (dir !== allowed && !dir.startsWith(allowed + sep))
    throw new LiveGuardError('--out must be under docs/demo/');
  return dir;
}

async function main(): Promise<number> {
  const f = parseFlags(process.argv.slice(2), ['base', 'views', 'out', 'width', 'height'], []);
  const base = liveBase(f.values['base']);
  const views = parseViews(f.values['views']);
  const dir = outDir(f.values['out']);
  const width = Number(f.values['width'] ?? 1440);
  const height = Number(f.values['height'] ?? 900);
  if (![width, height].every((n) => Number.isInteger(n) && n >= 320 && n <= 3840))
    throw new LiveGuardError('--width/--height must be 320..3840');
  mkdirSync(dir, { recursive: true });

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  let blocked = 0;
  try {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    await context.route('**/*', async (route) => {
      if (mustBlock(route.request().method(), route.request().url(), base)) {
        blocked++;
        await route.abort();
      } else await route.continue();
    });
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    for (const v of views) {
      await page.evaluate((h) => {
        location.hash = `#${h}`;
      }, v);
      await page.waitForTimeout(1200);
      const file = join(dir, `${v}.png`);
      await page.screenshot({ path: file, fullPage: false });
      log(P, `wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
  log(P, `OK (${views.length} shots; ${blocked} write/AI/OCR/session request(s) blocked)`);
  return 0;
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
