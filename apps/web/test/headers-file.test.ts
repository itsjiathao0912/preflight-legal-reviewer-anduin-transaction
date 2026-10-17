// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AC31 / D2 (F10): apps/web/public/_headers ships the CSP and security headers for static assets.
 * Assertion rule (G6): no `unsafe-eval` anywhere; no `unsafe-inline` in script-src or default-src.
 * The only evidence-based fallback allowed is `style-src 'self' 'unsafe-inline'`.
 */
const FILE = resolve(import.meta.dirname, '..', 'public', '_headers');

type Rules = Map<string, Map<string, string>>;

/** Minimal Cloudflare `_headers` parser: unindented URL pattern lines, indented `Name: value`. */
function parse(text: string): Rules {
  const rules: Rules = new Map();
  let current: Map<string, string> | undefined;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = new Map();
      rules.set(raw.trim(), current);
      continue;
    }
    const i = raw.indexOf(':');
    if (!current || i < 0) throw new Error(`malformed _headers line: ${raw}`);
    current.set(raw.slice(0, i).trim().toLowerCase(), raw.slice(i + 1).trim());
  }
  return rules;
}

function directives(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out.set(name.toLowerCase(), values);
  }
  return out;
}

const text = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
const rules = parse(text);
const all = rules.get('/*') ?? new Map<string, string>();
const csp = directives(all.get('content-security-policy') ?? '');

describe('headers-file', () => {
  it('should ship a _headers file with no unsafe-eval or unsafe-inline in script-src', () => {
    expect(existsSync(FILE)).toBe(true);
    expect(text).not.toMatch(/unsafe-eval/i);
    for (const d of ['script-src', 'default-src'])
      expect(csp.get(d) ?? [], d).not.toContain("'unsafe-inline'");
    const style = csp.get('style-src') ?? [];
    // the only permitted relaxation is exactly style-src 'self' 'unsafe-inline'
    if (style.includes("'unsafe-inline'")) expect(style).toEqual(["'self'", "'unsafe-inline'"]);
    else expect(style).toEqual(["'self'"]);
  });

  it('should hold every required CSP directive under /*', () => {
    expect(rules.has('/*')).toBe(true);
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'", 'https://challenges.cloudflare.com']);
    expect(csp.get('img-src')).toEqual(["'self'", 'blob:', 'data:']);
    expect(csp.get('font-src')).toEqual(["'self'"]);
    expect(csp.get('worker-src')).toEqual(["'self'", 'blob:']);
    // connect-src may gain https://challenges.cloudflare.com only on live evidence (R4)
    expect(csp.get('connect-src')?.[0]).toBe("'self'");
    for (const v of csp.get('connect-src') ?? [])
      expect(["'self'", 'https://challenges.cloudflare.com']).toContain(v);
    expect(csp.get('frame-src')).toEqual(['https://challenges.cloudflare.com']);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'none'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    for (const [, values] of csp) expect(values).not.toContain('*');
  });

  it('should set the security headers and no HSTS', () => {
    expect(all.get('x-content-type-options')).toBe('nosniff');
    expect(all.get('referrer-policy')).toBe('no-referrer');
    expect(all.get('cross-origin-opener-policy')).toBe('same-origin');
    const pp = all.get('permissions-policy') ?? '';
    for (const f of ['camera', 'microphone', 'geolocation', 'payment'])
      expect(pp).toContain(`${f}=()`);
    expect(all.has('strict-transport-security')).toBe(false);
  });

  it('should respect the Cloudflare _headers limits', () => {
    expect(rules.size).toBeLessThan(100);
    for (const line of text.split('\n')) expect(line.length).toBeLessThan(2000);
  });
});
