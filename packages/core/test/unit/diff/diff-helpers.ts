import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeHtml, runDeterministic } from '../../../src/engine';
import {
  diffDocuments,
  type DiffMode,
  type DiffResult,
  type SideInput,
} from '../../../src/diff/index';
import { mask } from '../../../src/memory/mask';
import { readSample } from '../../helpers/samples';

/** Fixture files are untrusted input data: read and parse only. */
export const DIFF_FIXTURES = fileURLToPath(
  new URL('../../../../../fixtures/diff/', import.meta.url),
);

export function sideOf(bytes: Uint8Array | string): SideInput & { ok: true } {
  const g = analyzeHtml(bytes);
  return { ok: true, structure: g.structure, graph: g, findings: runDeterministic(g) };
}

export const sampleSide = (n: number) => sideOf(readSample(n));
export const fixtureSide = (rel: string) =>
  sideOf(new Uint8Array(readFileSync(DIFF_FIXTURES + rel)));
export const fixtureJson = <T>(rel: string): T =>
  JSON.parse(readFileSync(DIFF_FIXTURES + rel, 'utf8')) as T;

export function diffOk(a: SideInput, b: SideInput, mode: DiffMode = 'version'): DiffResult {
  const o = diffDocuments({ a, b, mode });
  if ('error' in o) throw new Error(`diff failed: ${JSON.stringify(o.error)}`);
  return o.result;
}

/** Main-thread render: apply the allow-listed core mask over the result's spans. */
export function maskedRender(x: {
  text: string;
  sensitiveSpans: { start: number; end: number }[];
}): string {
  return mask(x.text, x.sensitiveSpans);
}

/** Every text-bearing excerpt / segment in a result (for leak scans). */
export function allTexts(
  r: DiffResult,
): Array<{ text: string; sensitiveSpans: { start: number; end: number }[] }> {
  const out: Array<{ text: string; sensitiveSpans: { start: number; end: number }[] }> = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.text === 'string' && Array.isArray(o.sensitiveSpans))
        out.push(o as { text: string; sensitiveSpans: { start: number; end: number }[] });
      else Object.values(o).forEach(walk);
    }
  };
  walk(r);
  return out;
}

/** Runs of 4+ consecutive digits of `secret` (as substrings) other than its last 4. */
export function leakedRuns(rendered: string, secret: string): string[] {
  const out: string[] = [];
  const last4 = secret.slice(-4);
  for (const m of rendered.matchAll(/\d{4,}/g)) {
    const run = m[0];
    for (let i = 0; i + 4 <= run.length; i++) {
      const piece = run.slice(i, i + 4);
      if (secret.includes(piece) && run !== last4) out.push(run);
    }
  }
  return [...new Set(out)];
}
