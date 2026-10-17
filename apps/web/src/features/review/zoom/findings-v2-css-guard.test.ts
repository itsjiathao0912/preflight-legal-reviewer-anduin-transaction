// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// AC-11, AC-A3 (E18) and the E21 class-usage cross-check for findings-v2.css.

const HERE = import.meta.dirname;
const CSS_PATH = resolve(HERE, '..', '..', '..', 'styles', 'findings-v2.css');
const css = readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

interface Rule {
  selectors: string[];
  body: string;
}

/** Collects style rules at top level and inside @media blocks (one nesting level). */
function rules(src: string): Rule[] {
  const out: Rule[] = [];
  let i = 0;
  const walk = (end: number) => {
    while (i < end) {
      const open = src.indexOf('{', i);
      if (open < 0 || open >= end) {
        i = end;
        return;
      }
      const prelude = src.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      if (prelude.startsWith('@media')) {
        i = open + 1;
        walk(j - 1);
        i = j;
      } else {
        out.push({
          selectors: prelude
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          body: src.slice(open + 1, j - 1),
        });
        i = j;
      }
    }
  };
  walk(src.length);
  return out;
}

const ALL = rules(css);
const SELECTORS = ALL.flatMap((r) => r.selectors);
const ALLOWED_START =
  /^(\.fv2(?![\w-])|\.fv2-|\.docscroll\[data-dz\]|\.work\.fv2-work|\.work > \.fv2(?![\w-]))/;

function bodyOf(selector: string): string {
  return ALL.filter((r) => r.selectors.includes(selector))
    .map((r) => r.body)
    .join('\n');
}

const ZOOM_TABLE: [string, string[]][] = [
  [
    '.docscroll[data-dz] .paper',
    ['max-width: calc(700px', 'calc(52px', 'calc(60px', 'calc(72px', 'font-size: calc(16px'],
  ],
  ['.docscroll[data-dz] .paper h1', ['font-size: calc(28px', 'margin-bottom: calc(4px']],
  ['.docscroll[data-dz] .paper .sub', ['font-size: calc(16px', 'margin-bottom: calc(36px']],
  [
    '.docscroll[data-dz] .paper h2',
    ['font-size: calc(17px', 'calc(38px', 'calc(10px', 'scroll-margin-top: calc(24px'],
  ],
  ['.docscroll[data-dz] .paper h2 small', ['font-size: calc(15px', 'margin-left: calc(6px']],
  ['.docscroll[data-dz] .paper h3', ['font-size: calc(15px', 'calc(20px', 'calc(6px']],
  ['.docscroll[data-dz] .paper p', ['margin-bottom: calc(13px']],
  ['.docscroll[data-dz] .paper .fields', ['calc(14px', 'calc(16px', 'font-size: calc(14px']],
  ['.docscroll[data-dz] .paper .opt', ['gap: calc(10px', 'font-size: calc(14px']],
  ['.docscroll[data-dz] .paper .opt .box', ['width: calc(13px', 'height: calc(13px']],
  ['.docscroll[data-dz] .paper ol.p', ['padding-left: calc(22px', 'margin-bottom: calc(13px']],
  ['.docscroll[data-dz] .paper ol.p li', ['margin-bottom: calc(6px']],
  ['.docscroll[data-dz] .paper .fold', ['font-size: calc(14px']],
  ['.docscroll[data-dz] .paper .mask', ['font-size: calc(14px', 'calc(1px', 'calc(6px']],
  [
    '.docscroll[data-dz] .paper mark.q',
    ['calc(1px', 'text-decoration-thickness: calc(2px', 'text-underline-offset: calc(3px'],
  ],
  ['.docscroll[data-dz]', ['padding-inline: 32px', 'overflow-x: auto', 'scrollbar-gutter: stable']],
];

describe('findings-v2-css-guard', () => {
  it('parses a non-trivial set of rules', () => {
    expect(ALL.length).toBeGreaterThan(40);
  });

  it('has no :root block and no gradients', () => {
    expect(css).not.toMatch(/:root/);
    expect(css).not.toMatch(/gradient/i);
  });

  it('starts every selector with an allowed prefix (media blocks included)', () => {
    const bad = SELECTORS.filter((s) => !ALLOWED_START.test(s));
    expect(bad).toEqual([]);
  });

  it('never overrides .row, .rowb or .fp', () => {
    const bad = SELECTORS.filter((s) => /\.(row|rowb|fp)(?![\w-])/.test(s));
    expect(bad).toEqual([]);
  });

  it('scopes every .paper override under .docscroll[data-dz]', () => {
    const bad = SELECTORS.filter((s) => /\.paper/.test(s) && !s.startsWith('.docscroll[data-dz] '));
    expect(bad).toEqual([]);
  });

  it('declares new custom properties only on .fv2 roots, never on :root', () => {
    for (const r of ALL) {
      if (!/--fv2-[\w-]+\s*:/.test(r.body)) continue;
      expect(r.selectors.every((s) => s === '.fv2' || s === '.fv2-modal')).toBe(true);
    }
  });

  it.each(ZOOM_TABLE)('zoom override table row %s', (selector, needles) => {
    const body = bodyOf(selector);
    expect(body, selector).not.toBe('');
    for (const n of needles) expect(body, `${selector}: ${n}`).toContain(n);
  });

  it('has the three .paper padding sets (desktop, 1279, 767)', () => {
    const pads = ALL.filter((r) => r.selectors.includes('.docscroll[data-dz] .paper'))
      .map((r) => /padding:\s*([^;]+);/.exec(r.body)?.[1] ?? '')
      .filter(Boolean);
    expect(pads.some((p) => p.includes('52px') && p.includes('60px') && p.includes('72px'))).toBe(
      true,
    );
    expect(pads.some((p) => p.includes('40px') && p.includes('36px') && p.includes('56px'))).toBe(
      true,
    );
    expect(pads.some((p) => p.includes('24px') && p.includes('16px') && p.includes('40px'))).toBe(
      true,
    );
  });

  it('has the work grid, mobile stacking and resizer rules', () => {
    expect(SELECTORS).toContain('.work.fv2-work');
    expect(SELECTORS).toContain('.work > .fv2');
    expect(bodyOf('.work > .fv2')).toContain('order: -1');
    expect(css).toMatch(/var\(--fpw/);
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*\.fv2-resizer\s*\{\s*display: none/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  // E21: runs meaningfully once both A2 agents have created their files (serial verify step).
  it('defines every fv2- class used in a className of a non-test v2/ or zoom/ tsx file', () => {
    const defined = new Set<string>();
    for (const s of SELECTORS)
      for (const m of s.matchAll(/\.(fv2(?:-[\w-]+)?)/g)) defined.add(m[1]!);
    const dirs = [resolve(HERE, '..', 'v2'), HERE];
    const missing: string[] = [];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.tsx') || name.includes('.test.') || name === 'test-helpers.tsx')
          continue;
        const src = readFileSync(join(dir, name), 'utf8');
        // className attributes plus every string / template-literal fragment, so classes built
        // in template literals (e.g. `fv2-sev sv-${row.sev}`) are not a silent coverage gap.
        const strings = [
          ...src.matchAll(/className=(?:\{[^}]*\}|"[^"]*"|'[^']*')/g),
          ...src.matchAll(/`[^`]*`|"[^"\n]*"|'[^'\n]*'/g),
        ].map((m) => m[0]);
        for (const str of strings) {
          for (const m of str.matchAll(/(?<![\w-])(fv2(?:-[\w-]*[\w])?)(?![\w-]|\$\{)/g)) {
            if (!defined.has(m[1]!)) missing.push(`${name}: ${m[1]}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
