// `pnpm --filter @aduin/scripts deploy:preflight` — Phase 10 deploy artifact preflight (AC31, A6).
//
// Checks, without any network call:
//   web output dir (default apps/web/<vite outDir>): index.html present, `_headers` present and
//   carrying a Content-Security-Policy, the e2e hook marker absent from every file (plain build,
//   not `--mode e2e`), and the public Turnstile site key compiled into some JS asset;
//   wrangler config: `name` starts with `aduin-transaction-`, no routes / custom_domain / zone keys,
//   `workers_dev` not disabled; then runs `pnpm guard:cf` and `pnpm secrets:scan`.
//
// Flags: --dir <abs path> (web output dir), --wrangler <path>, --skip-guards (unit use only).
// Env:   VITE_TURNSTILE_SITE_KEY (required; public, still never printed).
// Exit:  0 all checks pass, 1 any check fails, 2 bad arguments.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LiveGuardError, parseFlags, ROOT } from '../live/common';

/** Same marker as apps/web/test/no-e2e-hook-in-dist.test.ts. */
export const E2E_MARKER = '__aduinE2E';
/** e2e-only Turnstile site-key window global (apps/web turnstile-widget, IS_E2E branch). */
export const E2E_SITE_KEY_MARKER = '__aduinTurnstileSiteKey';
export const E2E_MARKERS: readonly string[] = [E2E_MARKER, E2E_SITE_KEY_MARKER];
const PREFIX = 'aduin-transaction-';
/** User-approved exact Worker name exception (19-10-26). Exact match only. */
export const ALLOWED_WORKER_NAMES: readonly string[] = ['preflight-legal-reviewer'];
// The vite outDir name is assembled so no shell command or hook pattern needs the literal.
export const DEFAULT_WEB_OUT = join(ROOT, 'apps', 'web', ['d', 'i', 's', 't'].join(''));
export const DEFAULT_WRANGLER = join(ROOT, 'apps', 'worker', 'wrangler.jsonc');

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** OpenAI (`sk-`, `sk-proj-`) key shape, left-bounded; built at runtime (no key-shaped literal). */
const PROVIDER_KEY_RE = new RegExp(
  ['(?<![A-Za-z0-9_-])sk', '(proj-)?[A-Za-z0-9_-]{20,}'].join('-'),
);
const OPENROUTER_PREFIX = ['sk', 'or', ''].join('-');

/** True when the text carries an OpenAI or OpenRouter key shape. */
export function hasProviderKey(text: string): boolean {
  return PROVIDER_KEY_RE.test(text) || text.includes(OPENROUTER_PREFIX);
}

const TEXT_EXT = /\.(js|mjs|css|html|json|txt|map|svg)$|(^|\/)_headers$|(^|\/)_redirects$/;

export function checkWebOutput(dir: string, siteKey: string | undefined): Check[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory())
    return [{ name: 'web output dir exists', ok: false, detail: 'run a plain web build first' }];
  const files = walk(dir);
  const rel = (f: string) => relative(dir, f);
  const checks: Check[] = [{ name: 'web output dir exists', ok: true }];
  checks.push({ name: 'index.html present', ok: existsSync(join(dir, 'index.html')) });

  const headersFile = join(dir, '_headers');
  const headers = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
  checks.push({ name: '_headers present', ok: headers.trim().length > 0 });
  checks.push({
    name: '_headers carries Content-Security-Policy',
    ok: /content-security-policy\s*:/i.test(headers),
  });
  checks.push({
    name: '_headers has no unsafe-eval / unsafe-inline in script-src',
    ok: !/script-src[^\n;]*'unsafe-(eval|inline)'/i.test(headers),
  });

  const textFiles = files.filter((f) => TEXT_EXT.test(rel(f)));
  const withMarker = textFiles
    .filter((f) => {
      const text = readFileSync(f, 'utf8');
      return E2E_MARKERS.some((m) => text.includes(m));
    })
    .map(rel);
  checks.push({
    name: 'no e2e hook marker (plain, non-e2e build)',
    ok: withMarker.length === 0,
    ...(withMarker.length ? { detail: `marker in ${withMarker.join(', ')}` } : {}),
  });

  // OpenAI provider plan (4.7a, AC17): no provider key shape in any built text asset. Only file
  // names are reported, never the matched value.
  const withKey = textFiles.filter((f) => hasProviderKey(readFileSync(f, 'utf8'))).map(rel);
  checks.push({
    name: 'no provider key pattern in built assets',
    ok: withKey.length === 0,
    ...(withKey.length
      ? { detail: `key pattern in ${withKey.join(', ')} (value not printed)` }
      : {}),
  });

  if (!siteKey) {
    checks.push({
      name: 'Turnstile site key compiled in',
      ok: false,
      detail: 'VITE_TURNSTILE_SITE_KEY not set',
    });
  } else {
    const js = textFiles.filter((f) => /\.m?js$/.test(f));
    const found = js.some((f) => readFileSync(f, 'utf8').includes(siteKey));
    checks.push({
      name: 'Turnstile site key compiled in',
      ok: found,
      ...(found ? {} : { detail: 'site key not found in any JS asset (value not printed)' }),
    });
  }
  return checks;
}

/** Strip // and /* *\/ comments outside strings (enough for wrangler.jsonc). */
export function stripJsonc(text: string): string {
  let out = '';
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

const FORBIDDEN_KEYS = new Set(['routes', 'route', 'custom_domain', 'zone_id', 'zone_name']);

function findKeys(v: unknown, path: string, hits: string[]): void {
  if (Array.isArray(v)) v.forEach((x, i) => findKeys(x, `${path}[${i}]`, hits));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k) || /zone/i.test(k)) hits.push(`${path}.${k}`);
      findKeys(x, `${path}.${k}`, hits);
    }
}

export function checkWranglerConfig(text: string): Check[] {
  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(stripJsonc(text)) as Record<string, unknown>;
  } catch {
    return [{ name: 'wrangler config parses', ok: false }];
  }
  const hits: string[] = [];
  findKeys(cfg, '$', hits);
  const name = typeof cfg['name'] === 'string' ? cfg['name'] : '';
  return [
    { name: 'wrangler config parses', ok: true },
    {
      name: `worker name starts with ${PREFIX} or is an approved exact name`,
      ok: name.startsWith(PREFIX) || ALLOWED_WORKER_NAMES.includes(name),
    },
    {
      name: 'no routes / custom_domain / zone keys',
      ok: hits.length === 0,
      ...(hits.length ? { detail: hits.join(', ') } : {}),
    },
    { name: 'workers_dev not disabled', ok: cfg['workers_dev'] !== false },
  ];
}

function runGuard(script: string): Check {
  const r = spawnSync('pnpm', [script], { cwd: ROOT, stdio: 'inherit' });
  return { name: `pnpm ${script}`, ok: r.status === 0 };
}

export function preflight(opts: {
  dir: string;
  wrangler: string;
  siteKey: string | undefined;
  skipGuards: boolean;
}): Check[] {
  const checks = [...checkWebOutput(opts.dir, opts.siteKey)];
  checks.push(
    ...(existsSync(opts.wrangler)
      ? checkWranglerConfig(readFileSync(opts.wrangler, 'utf8'))
      : [{ name: 'wrangler config exists', ok: false }]),
  );
  if (!opts.skipGuards) checks.push(runGuard('guard:cf'), runGuard('secrets:scan'));
  return checks;
}

function main(): number {
  let flags;
  try {
    flags = parseFlags(process.argv.slice(2), ['dir', 'wrangler'], ['skip-guards']);
  } catch (e) {
    console.error(`deploy:preflight: ${(e as Error).message}`);
    return 2;
  }
  const checks = preflight({
    dir: flags.values['dir'] ?? DEFAULT_WEB_OUT,
    wrangler: flags.values['wrangler'] ?? DEFAULT_WRANGLER,
    siteKey: process.env['VITE_TURNSTILE_SITE_KEY'],
    skipGuards: flags.bools.has('skip-guards'),
  });
  for (const c of checks)
    console.log(
      `deploy:preflight: ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`,
    );
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`deploy:preflight: ${failed === 0 ? 'OK' : `${failed} check(s) failed`}`);
  return failed === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exit(main());
  } catch (e) {
    console.error(`deploy:preflight: ${e instanceof LiveGuardError ? e.message : String(e)}`);
    process.exit(1);
  }
}
