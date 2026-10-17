import { describe, expect, it } from 'vitest';
import { runVariance } from '../../src/variance/index';
import {
  demoPair,
  sampleVSide,
  seededPair,
  sideOfHtml,
  VARIANCE_FIXTURES,
} from '../helpers/variance';
import { readFileSync } from 'node:fs';

/**
 * AC-V20: same inputs and config give byte-equal changes, classes, impacts, owners and findings
 * across repeated runs, including freshly parsed inputs (no shared caches) for each run.
 */
describe('variance-determinism-repeat-run', () => {
  it('should produce byte-equal output across 3 repeated runs', () => {
    const fresh = (rel: string, label: string) =>
      sideOfHtml(new Uint8Array(readFileSync(VARIANCE_FIXTURES + rel)), label);
    const runs = [0, 1, 2].map(() =>
      JSON.stringify(
        runVariance({
          baseline: fresh('hartwell-crane/fund-II.html', 'Fund II'),
          current: fresh('hartwell-crane/fund-III.html', 'Fund III'),
        }),
      ),
    );
    expect(runs[1]).toBe(runs[0]);
    expect(runs[2]).toBe(runs[0]);
    expect(JSON.stringify(runVariance(demoPair()))).toBe(runs[0]);
  });

  it('is byte-equal across runs on real pair #5 -> #6 and a truncated seeded pair', () => {
    const a = [0, 1, 2].map(() =>
      JSON.stringify(
        runVariance({ baseline: sampleVSide(5, '#5'), current: sampleVSide(6, '#6') }),
      ),
    );
    expect(new Set(a).size).toBe(1);
    const t = [0, 1, 2].map(() => JSON.stringify(runVariance(seededPair('edge-truncated'))));
    expect(new Set(t).size).toBe(1);
  });
});
