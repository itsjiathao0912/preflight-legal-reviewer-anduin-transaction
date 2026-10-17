import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared parser of design/mockups/app.html (the layout and token spec). Every expected size, radius,
 * width and breakpoint in the Phase 03 tests is derived here at test time, never hard-coded.
 */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const APP_HTML = resolve(REPO_ROOT, 'design', 'mockups', 'app.html');

export function mockupHtml(): string {
  return readFileSync(APP_HTML, 'utf8');
}

export function mockupCss(): string {
  const html = mockupHtml();
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!m) throw new Error('app.html has no <style> block');
  return m[1]!;
}

/**
 * The shell + Findings part of the mockup CSS (what Phase 03 builds): everything before the
 * "Screens beyond Findings" marker plus the "narrow desktop (1024)" block. Later screens (Structure,
 * Compare, Memory, Documents) add their own sizes; they are derived by the phases that build them.
 */
export function findingsCss(css: string = mockupCss()): string {
  const cut = css.indexOf('/* ===== Screens beyond Findings');
  if (cut < 0) throw new Error('no "Screens beyond Findings" marker in app.html');
  const narrow = css.indexOf('/* narrow desktop (1024) */');
  if (narrow < 0) throw new Error('no "narrow desktop (1024)" block in app.html');
  return css.slice(0, cut) + '\n' + css.slice(narrow);
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Custom properties declared in the first :root block. */
export function rootVars(css: string = mockupCss()): Record<string, string> {
  const m = stripComments(css).match(/:root\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error('no :root block');
  const out: Record<string, string> = {};
  for (const decl of m[1]!.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim();
    if (k.startsWith('--')) out[k] = decl.slice(i + 1).trim();
  }
  return out;
}

/** px font sizes used anywhere in the CSS (font-size and the font shorthand). */
export function fontSizes(css: string = mockupCss()): number[] {
  const c = stripComments(css);
  const set = new Set<number>();
  for (const m of c.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/g)) set.add(Number(m[1]));
  for (const m of c.matchAll(/font\s*:\s*([^;}]+)/g)) {
    const v = m[1]!;
    if (v.trim() === 'inherit') continue;
    const px = v.match(/(\d+(?:\.\d+)?)px(?:\/[\d.]+)?/);
    if (px) set.add(Number(px[1]));
  }
  return [...set].sort((a, b) => a - b);
}

/** Single-value border radii (px) used in the CSS; var(--r) resolves to the :root value. */
export function radii(css: string = mockupCss()): number[] {
  const c = stripComments(css);
  const r = rootVars(css)['--r'];
  const set = new Set<number>();
  for (const m of c.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
    const parts = m[1]!.trim().split(/\s+/);
    for (const p of parts) {
      const v = p === 'var(--r)' ? r : p;
      const px = v?.match(/^(\d+(?:\.\d+)?)px$/);
      if (px) set.add(Number(px[1]));
      else if (v === '0') set.add(0);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function pxOf(s: string | undefined): number {
  const m = s?.match(/(\d+)px/);
  if (!m) throw new Error(`no px value in ${s}`);
  return Number(m[1]);
}

/** Shell widths: expanded sidebar (--sbw), rail (.app.rail --sbw), findings column wide / narrow. */
export function shellWidths(css: string = mockupCss()) {
  const c = stripComments(css);
  const sidebar = pxOf(c.match(/\.app\{--sbw:(\d+px)/)?.[1]);
  const rail = pxOf(c.match(/\.app\.rail\{--sbw:(\d+px)/)?.[1]);
  const column = pxOf(
    c.match(/\.work\{display:grid;grid-template-columns:minmax\(0,1fr\) (\d+px)/)?.[1],
  );
  const narrowBlock = [...c.matchAll(/@media \(max-width:(\d+)px\)\{([\s\S]*?)\n\}/g)].find((m) =>
    /\.work\{grid-template-columns/.test(m[2]!),
  );
  if (!narrowBlock) throw new Error('no narrow .work media block');
  const narrowColumn = pxOf(
    narrowBlock[2]!.match(/\.work\{grid-template-columns:minmax\(0,1fr\) (\d+px)/)?.[1],
  );
  const minWidth = pxOf(c.match(/\.app\{[^}]*min-width:(\d+px)/)?.[1]);
  return { sidebar, rail, column, narrowColumn, narrowMax: Number(narrowBlock[1]), minWidth };
}

/** Auto-rail breakpoint from the mockup script: matchMedia('(max-width:NNNNpx)'). */
export function railMaxWidth(html: string = mockupHtml()): number {
  const m = html.match(/matchMedia\('\(max-width:(\d+)px\)'\)/);
  if (!m) throw new Error('no rail matchMedia in app.html');
  return Number(m[1]);
}

/** The SEV table from the mockup script. */
export function sevTable(
  html: string = mockupHtml(),
): Record<string, { label: string; short: string }> {
  const m = html.match(/const SEV=\{([\s\S]*?)\};/);
  if (!m) throw new Error('no SEV table');
  const out: Record<string, { label: string; short: string }> = {};
  for (const e of m[1]!.matchAll(/(\w+):\{label:'([^']+)',short:'([^']+)'/g))
    out[e[1]!] = { label: e[2]!, short: e[3]! };
  return out;
}

/** The REASONS list from the mockup script. */
export function reasonsList(html: string = mockupHtml()): string[] {
  const m = html.match(/const REASONS=\[([^\]]*)\]/);
  if (!m) throw new Error('no REASONS');
  return [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
}

/**
 * Phase 07: the Compare screen vocabulary = the shell + Findings CSS plus the shared "Screens beyond
 * Findings" head (up to the first per-screen block) and the "===== Compare versions =====" block.
 */
export function compareCss(css: string = mockupCss()): string {
  const shared = css.indexOf('/* ===== Screens beyond Findings');
  const sharedEnd = css.indexOf('/* tables (Structure, Memory) */');
  const start = css.indexOf('/* ===== Compare versions ===== */');
  const end = css.indexOf('/* ===== Memory ===== */');
  if (shared < 0 || sharedEnd < shared || start < 0 || end < start)
    throw new Error('no "Compare versions" block in app.html');
  return findingsCss(css) + '\n' + css.slice(shared, sharedEnd) + '\n' + css.slice(start, end);
}

/** design/mockups/findings-v2.html: the Findings v2 panel, zoom and action-bar spec (Phase B). */
export const FINDINGS_V2_HTML = resolve(REPO_ROOT, 'design', 'mockups', 'findings-v2.html');

export function findingsV2Html(): string {
  return readFileSync(FINDINGS_V2_HTML, 'utf8');
}

/** Every <style> block of findings-v2.html, joined in document order. */
export function findingsV2Css(html: string = findingsV2Html()): string {
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!);
  if (blocks.length === 0) throw new Error('findings-v2.html has no <style> block');
  return blocks.join('\n');
}

/**
 * Panel geometry from findings-v2.html: default percent of `.work` (wide at or above `wideMin`
 * px, narrow below), the drag clamp, and the splitter handle width (the 8px middle grid column).
 */
export function findingsV2Widths(html: string = findingsV2Html()) {
  const def = html.match(/window\.innerWidth>=(\d+)\?(\d+):(\d+)/);
  if (!def) throw new Error('no default panel percent in findings-v2.html');
  const clamp = html.match(/Math\.max\((\d+),Math\.min\((\d+),v\)\)/);
  if (!clamp) throw new Error('no panel clamp in findings-v2.html');
  const handle = stripComments(findingsV2Css(html)).match(
    /\.work\{[^}]*grid-template-columns:minmax\(0,1fr\) (\d+)px var\(--fpw/,
  );
  if (!handle) throw new Error('no splitter column in findings-v2.html .work');
  return {
    wideMin: Number(def[1]),
    wide: Number(def[2]),
    narrow: Number(def[3]),
    min: Number(clamp[1]),
    max: Number(clamp[2]),
    handle: Number(handle[1]),
  };
}

/**
 * Selectors that carry a static box-shadow in findings-v2.html (keyframes excluded). The style
 * audit maps them to their v2 class names and allows a shadow only there (E-B7).
 */
export function findingsV2ShadowSelectors(css: string = findingsV2Css()): string[] {
  const c = stripComments(css).replace(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '');
  const out: string[] = [];
  for (const m of c.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/box-shadow\s*:/.test(m[2]!)) out.push(m[1]!.trim());
  }
  return out;
}
