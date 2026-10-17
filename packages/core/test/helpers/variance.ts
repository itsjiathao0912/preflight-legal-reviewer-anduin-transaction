import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import type { VarianceSide } from '../../src/variance/index';
import { readSample } from './samples';

/** Variance test helper: fixtures/variance/** are untrusted input data (read and parse only). */
export const VARIANCE_FIXTURES = fileURLToPath(
  new URL('../../../../fixtures/variance/', import.meta.url),
);
export const FIRM = 'hartwell-crane';

export function sideOfHtml(
  html: string | Uint8Array,
  label: string,
  firmId: string | null = FIRM,
): VarianceSide {
  const g = analyzeHtml(typeof html === 'string' ? html : html);
  return { structure: g.structure, graph: g, findings: runDeterministic(g), firmId, label };
}

const cache = new Map<string, VarianceSide>();

/** Fixture side (cached per test file): `rel` under fixtures/variance/. */
export function vside(rel: string, label: string, firmId: string | null = FIRM): VarianceSide {
  const key = `${rel}|${label}|${firmId}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = sideOfHtml(new Uint8Array(readFileSync(VARIANCE_FIXTURES + rel)), label, firmId);
    cache.set(key, hit);
  }
  return hit;
}

export const sampleVSide = (n: number, label: string) =>
  sideOfHtml(readSample(n), label, 'partners-group');

export const demoPair = () => ({
  baseline: vside('hartwell-crane/fund-II.html', 'Fund II'),
  current: vside('hartwell-crane/fund-III.html', 'Fund III'),
});

export interface ExpectedRow {
  class: 'new' | 'changed_logic';
  rule_id: string;
  unit_key_b?: string;
  unit_key_a?: string;
  contains: string;
  investor_types_include?: string[];
  investor_types_exclude?: string[];
  conditionals?: number;
  reusable?: 'yes' | 'no';
}
export interface SeededCase {
  id: string;
  kind: 'cosmetic' | 'logic' | 'edge' | 'impact';
  note: string;
  expect: {
    shown: number;
    cosmetic: number;
    groups?: Record<string, number>;
    rows?: ExpectedRow[];
  };
}

export function expectedSeeded(): SeededCase[] {
  return (
    JSON.parse(readFileSync(VARIANCE_FIXTURES + 'expected/seeded.json', 'utf8')) as {
      cases: SeededCase[];
    }
  ).cases;
}

export interface DemoItem {
  id: string;
  label: string;
  unit_key_b: string;
  class: 'new' | 'changed_logic';
  rule_id: string;
  owners: string[];
  passage: string;
}
export interface ExpectedDemo {
  raw: number;
  shown: number;
  new: number;
  changed_logic: number;
  cosmetic: number;
  groups: Record<string, number>;
  items: DemoItem[];
  r01: {
    removed_unit_key_a: string;
    assertion: { kind: 'scope_exists'; label: string };
    statement: string;
    source_fund: string;
  };
}

export function expectedDemo(): ExpectedDemo {
  return JSON.parse(
    readFileSync(VARIANCE_FIXTURES + 'expected/hartwell-crane.json', 'utf8'),
  ) as ExpectedDemo;
}

export const seededPair = (id: string) => ({
  baseline: vside(`seeded/${id}-a.html`, 'A'),
  current: vside(`seeded/${id}-b.html`, 'B'),
});

/** Tiny inline document builder for named cases: cover lines + [number, title, paragraphs]. */
export function doc(cover: string[], sections: Array<[string, string, string[]]>): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lines = [
    '<p><b>SUBSCRIPTION AGREEMENT</b></p>',
    ...cover.map((c) => `<p>${esc(c)}</p>`),
    ...sections.flatMap(([n, title, ps]) => [
      `<p><b>${n}. ${esc(title)}</b></p>`,
      ...ps.map((p) => `<p>${esc(p)}</p>`),
    ]),
  ];
  return `<html><body>\n${lines.join('\n')}\n</body></html>\n`;
}
