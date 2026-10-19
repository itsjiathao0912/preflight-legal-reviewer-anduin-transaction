import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkWebOutput,
  checkWranglerConfig,
  E2E_MARKER,
  E2E_SITE_KEY_MARKER,
  preflight,
} from '../../src/deploy/preflight';

const SITE = 'site-key-sample-0001';
let dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});
function out(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'aduin-pre-'));
  dirs.push(d);
  for (const [f, t] of Object.entries(files)) {
    mkdirSync(join(d, f, '..'), { recursive: true });
    writeFileSync(join(d, f), t);
  }
  return d;
}
const good = {
  'index.html': '<!doctype html>',
  _headers:
    "/*\n  Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com\n",
  'assets/app.js': `const k="${SITE}";`,
};
const failed = (cs: { name: string; ok: boolean }[]) => cs.filter((c) => !c.ok).map((c) => c.name);

describe('deploy:preflight web output', () => {
  it('passes a plain build with _headers and the site key', () => {
    expect(failed(checkWebOutput(out(good), SITE))).toEqual([]);
  });
  it('fails when _headers is missing', () => {
    const { _headers: _, ...rest } = good;
    expect(failed(checkWebOutput(out(rest), SITE))).toContain('_headers present');
  });
  it('fails on an e2e build (hook marker present)', () => {
    expect(
      failed(checkWebOutput(out({ ...good, 'assets/e.js': `window.${E2E_MARKER}={}` }), SITE)),
    ).toEqual(['no e2e hook marker (plain, non-e2e build)']);
  });
  it('fails when the e2e Turnstile site-key global is in the output', () => {
    expect(
      failed(
        checkWebOutput(out({ ...good, 'assets/k.js': `window.${E2E_SITE_KEY_MARKER}` }), SITE),
      ),
    ).toEqual(['no e2e hook marker (plain, non-e2e build)']);
  });
  it('fails when the site key is absent or not compiled in, without printing it', () => {
    expect(failed(checkWebOutput(out(good), undefined))).toEqual([
      'Turnstile site key compiled in',
    ]);
    const cs = checkWebOutput(out({ ...good, 'assets/app.js': 'x' }), SITE);
    expect(failed(cs)).toEqual(['Turnstile site key compiled in']);
    expect(JSON.stringify(cs)).not.toContain(SITE);
  });
  // OpenAI provider plan (4.7a, AC17): key-shaped fixtures built at runtime
  it('fails when a provider key pattern is in a built asset, without printing it', () => {
    const oaKey = ['sk', 'proj', 'Q7w_'.repeat(8)].join('-');
    const orKey = ['sk', 'or', 'v1', 'b'.repeat(40)].join('-');
    for (const k of [oaKey, orKey]) {
      const cs = checkWebOutput(out({ ...good, 'assets/leak.js': `const a="${k}";` }), SITE);
      expect(failed(cs)).toEqual(['no provider key pattern in built assets']);
      expect(JSON.stringify(cs)).not.toContain(k);
      expect(JSON.stringify(cs)).toContain('assets/leak.js');
    }
    const word = ['task', 'list', 'container', 'scroll', 'area', 'wide'].join('-');
    expect(failed(checkWebOutput(out({ ...good, 'assets/w.js': word }), SITE))).toEqual([]);
  });
  it('fails on unsafe-inline scripts and a missing dir', () => {
    const bad = {
      ...good,
      _headers: "/*\n  Content-Security-Policy: script-src 'self' 'unsafe-inline'\n",
    };
    expect(failed(checkWebOutput(out(bad), SITE))).toContain(
      '_headers has no unsafe-eval / unsafe-inline in script-src',
    );
    expect(failed(checkWebOutput(join(tmpdir(), 'nope-aduin-x'), SITE))).toEqual([
      'web output dir exists',
    ]);
  });
});

describe('deploy:preflight wrangler config', () => {
  const ok = `// c\n{ "name": "aduin-transaction-web", /* x */ "assets": { "directory": "../web/out" }, "d1_databases": [{ "database_name": "aduin-transaction-db" }], }`;
  it('passes a prefixed workers.dev-only config (jsonc)', () => {
    expect(failed(checkWranglerConfig(ok))).toEqual([]);
  });
  it('passes the approved exact Worker name preflight-legal-reviewer', () => {
    expect(
      failed(checkWranglerConfig(ok.replace('aduin-transaction-web', 'preflight-legal-reviewer'))),
    ).toEqual([]);
  });
  it.each([
    [
      'unprefixed name',
      '{ "name": "web" }',
      'worker name starts with aduin-transaction- or is an approved exact name',
    ],
    [
      'look-alike of the approved name',
      '{ "name": "preflight-legal-reviewer-x" }',
      'worker name starts with aduin-transaction- or is an approved exact name',
    ],
    [
      'routes key',
      '{ "name": "aduin-transaction-web", "routes": [] }',
      'no routes / custom_domain / zone keys',
    ],
    [
      'custom domain',
      '{ "name": "aduin-transaction-web", "x": [{ "custom_domain": true }] }',
      'no routes / custom_domain / zone keys',
    ],
    [
      'zone key',
      '{ "name": "aduin-transaction-web", "env": { "p": { "zone_name": "z" } } }',
      'no routes / custom_domain / zone keys',
    ],
    [
      'workers_dev false',
      '{ "name": "aduin-transaction-web", "workers_dev": false }',
      'workers_dev not disabled',
    ],
  ])('fails on %s', (_n, text, check) => {
    expect(failed(checkWranglerConfig(text))).toContain(check);
  });
  it('preflight aggregates both (guards skipped offline)', () => {
    const w = out({ 'wrangler.jsonc': ok });
    expect(
      failed(
        preflight({
          dir: out(good),
          wrangler: join(w, 'wrangler.jsonc'),
          siteKey: SITE,
          skipGuards: true,
        }),
      ),
    ).toEqual([]);
  });
});
