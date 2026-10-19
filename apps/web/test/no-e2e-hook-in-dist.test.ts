// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const MARKER = '__aduinE2E';
const dirs: string[] = [];
/**
 * OpenAI provider plan (AC17): provider key shapes (OpenAI `sk-...` / `sk-proj-...`, which also
 * covers the OpenRouter `sk-or-` prefix) built at runtime so this file holds no key-shaped literal.
 */
const KEY_RE = new RegExp(['(?<![A-Za-z0-9_-])sk', '(proj-)?[A-Za-z0-9_-]{20,}'].join('-'));
const OPENAI_ENV_NAME = ['OPENAI', 'API', 'KEY'].join('_');

function allText(dir: string): string {
  let s = '';
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) s += allText(p);
    else if (/\.(js|html|css|mjs)$/.test(n)) s += readFileSync(p, 'utf8');
  }
  return s;
}

async function buildTo(mode: string): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), `aduin-web-${mode}-`));
  dirs.push(outDir);
  await build({ root: ROOT, mode, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  return allText(outDir);
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('no-e2e-hook-in-dist', () => {
  it('should not ship the E2E failure hook in the production build', async () => {
    const prod = await buildTo('production');
    expect(prod.length).toBeGreaterThan(10_000);
    expect(prod.includes(MARKER)).toBe(false);
    expect(prod.includes('e2eFailStage')).toBe(false);
    // Phase 09: the force-invalid-outline hook must not ship either
    expect(prod.includes('forceInvalidOutline')).toBe(false);
    // Phase 08b: the real-memory opt-in must not ship either
    expect(prod.includes('useRealMemory')).toBe(false);
    // Phase 10: the e2e Turnstile site-key override must not ship either
    expect(prod.includes('__aduinTurnstileSiteKey')).toBe(false);
    // Variance Phase 02 (C1b): the variance delay / failure seam must not ship either
    expect(prod.includes('varianceDelayMs')).toBe(false);
    expect(prod.includes('varianceFail')).toBe(false);
    expect(prod.includes('e2eVariance')).toBe(false);
    // OpenAI provider plan (AC17): no provider key pattern and no key env name in the bundle
    expect(KEY_RE.exec(prod)?.[0].slice(0, 6) ?? null).toBeNull();
    expect(prod.includes(OPENAI_ENV_NAME)).toBe(false);
    expect(KEY_RE.test(['x sk', 'proj', 'a'.repeat(24)].join('-'))).toBe(true); // control
  }, 180_000);

  it('positive control: the e2e build does contain the hook marker', async () => {
    const e2e = await buildTo('e2e');
    expect(e2e.includes(MARKER)).toBe(true);
    expect(e2e.includes('forceInvalidOutline')).toBe(true);
    expect(e2e.includes('useRealMemory')).toBe(true);
    expect(e2e.includes('__aduinTurnstileSiteKey')).toBe(true);
    expect(e2e.includes('varianceDelayMs')).toBe(true);
    expect(e2e.includes('varianceFail')).toBe(true);
    expect(e2e.includes('e2eVariance')).toBe(true);
  }, 180_000);
});
