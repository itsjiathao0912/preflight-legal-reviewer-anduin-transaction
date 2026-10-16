// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..', 'src');
const GUARDED = ['components', 'shell', 'features'].map((d) => join(SRC, d));

function files(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx|css)$/.test(n)) out.push(p);
  }
  return out;
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/** Default shadcn/ui color classes (never ship default shadcn styling). */
const SHADCN =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:primary|secondary|muted|accent|destructive|popover|card|background|foreground|input|border)(?:-foreground)?\b/g;
const RAW_HTML = /dangerouslySetInnerHTML|\.innerHTML\s*=/g;

describe('source-guard', () => {
  const list = GUARDED.flatMap(files);
  it('scans the component, shell and feature sources', () => {
    expect(list.length).toBeGreaterThan(15);
  });
  it('has no hex colors in components, shell or features', () => {
    const hits = list.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(HEX)].map((m) => `${f}: ${m[0]}`),
    );
    // `#${name}` sprite refs and `#findings/…` routes are template strings, not literals matching HEX.
    expect(hits).toEqual([]);
  });
  it('has no default shadcn color classes', () => {
    const hits = list.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(SHADCN)].map((m) => `${f}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
  it('never renders raw HTML', () => {
    const all = files(SRC);
    const hits = all.flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(RAW_HTML)].map((m) => `${f}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
