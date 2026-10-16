import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import type { DocGraph } from '../../src/graph/graph';
import type { Finding } from '../../src/findings/schema';

/** Samples are untrusted input data: read and parse only. */
export const SAMPLES_DIR = fileURLToPath(
  new URL('../../../../samples/sub-docs/raw/', import.meta.url),
);

export function sampleFile(n: number): string {
  const prefix = String(n).padStart(2, '0') + '-';
  const f = readdirSync(SAMPLES_DIR).find((x) => x.startsWith(prefix) && x.endsWith('.htm'));
  if (!f) throw new Error(`sample ${n} not found`);
  return f;
}

export function htmlSamples(): string[] {
  return readdirSync(SAMPLES_DIR)
    .filter((x) => x.endsWith('.htm'))
    .sort();
}

export function readSample(n: number | string): Uint8Array {
  const f = typeof n === 'number' ? sampleFile(n) : n;
  return new Uint8Array(readFileSync(SAMPLES_DIR + f));
}

const cache = new Map<string, { g: DocGraph; findings: Finding[] }>();

/** Analyze + run detectors once per sample per test file. */
export function analyzed(n: number | string): { g: DocGraph; findings: Finding[] } {
  const key = String(n);
  let hit = cache.get(key);
  if (!hit) {
    const g = analyzeHtml(readSample(n));
    hit = { g, findings: runDeterministic(g) };
    cache.set(key, hit);
  }
  return hit;
}

export function blockText(g: DocGraph, i: number): string {
  return g.structure.blocks[i]!.lines.map((l) => l.text).join(' ');
}
