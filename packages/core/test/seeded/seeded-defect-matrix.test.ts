import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { detectors } from '../../src/detectors/registry';
import type { Finding } from '../../src/findings/schema';

/**
 * seeded-defect-matrix (AC18): every Phase 02 deterministic detector has a clean control and at
 * least one seeded defect under fixtures/html-seeded/<detector>/ (expectations authored in
 * scripts/src/fixtures/build-seeded.ts). Recall 100%, precision >= 90%, clean controls silent.
 * An empty or missing fixture directory fails (test:seeded no longer passes with no tests).
 */
const ROOT = new URL('../../../../fixtures/html-seeded/', import.meta.url);
const PHASE01 = ['ref-this-section', 'ref-label-coherence', 'undefined-term'];

interface Expected {
  detector: string;
  issue_class: string;
  cases: Array<{
    file: string;
    kind: 'clean' | 'defect';
    note: string;
    expect: Array<{ detector_id: string; issue_class: string; count: number }>;
  }>;
}

function classes(): Expected[] {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT)
    .filter((d) => !d.startsWith('.') && statSync(new URL(d, ROOT)).isDirectory())
    .sort()
    .map((d) => JSON.parse(readFileSync(new URL(`${d}/expected.json`, ROOT), 'utf8')) as Expected);
}

function run(detector: string, file: string): Finding[] {
  return runDeterministic(analyzeHtml(readFileSync(new URL(`${detector}/${file}`, ROOT), 'utf8')));
}

describe('seeded-defect-matrix (AC18)', () => {
  const all = classes();

  it('has a fixture directory for every Phase 02 detector (an empty set fails)', () => {
    expect(all.length).toBeGreaterThanOrEqual(10);
    const p02 = detectors.map((d) => d.id).filter((id) => !PHASE01.includes(id));
    expect(all.map((c) => c.detector).sort()).toEqual([...p02].sort());
    for (const c of all) {
      expect(
        c.cases.some((k) => k.kind === 'clean'),
        c.detector,
      ).toBe(true);
      expect(
        c.cases.some((k) => k.kind === 'defect'),
        c.detector,
      ).toBe(true);
      expect(detectors.find((d) => d.id === c.detector)!.class).toBe(c.issue_class);
    }
  });

  it('should detect every seeded defect and stay silent on every clean control', () => {
    let expectedTotal = 0;
    let truePositives = 0;
    let predicted = 0;
    const misses: string[] = [];
    const extras: string[] = [];
    for (const c of all) {
      for (const k of c.cases) {
        const found = run(c.detector, k.file);
        predicted += found.length;
        if (k.kind === 'clean') {
          if (found.length)
            extras.push(`${c.detector}/${k.file}: ${found.map((f) => f.detector_id).join(',')}`);
          continue;
        }
        const own = c.detector;
        expect(
          k.expect.some((x) => x.detector_id === own),
          `${own}/${k.file}`,
        ).toBe(true);
        for (const x of k.expect) {
          expectedTotal += x.count;
          const got = found.filter(
            (f) => f.detector_id === x.detector_id && f.issue_class === x.issue_class,
          );
          truePositives += Math.min(got.length, x.count);
          if (got.length < x.count)
            misses.push(`${own}/${k.file}: ${x.detector_id} ${got.length}/${x.count}`);
        }
        const listed = new Set(k.expect.map((x) => x.detector_id));
        for (const f of found)
          if (!listed.has(f.detector_id)) extras.push(`${own}/${k.file}: ${f.detector_id}`);
      }
    }
    const recall = truePositives / expectedTotal;
    const precision = truePositives / predicted;
    console.info(
      `[seeded] expected=${expectedTotal} tp=${truePositives} predicted=${predicted} recall=${recall} precision=${precision.toFixed(3)}`,
    );
    expect(misses).toEqual([]);
    expect(recall).toBe(1);
    expect(precision).toBeGreaterThanOrEqual(0.9);
    expect(extras).toEqual([]);
  });
});
