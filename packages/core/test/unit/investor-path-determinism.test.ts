import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeHtml } from '../../src/engine';
import { investorModel } from '../../src/investor/paths';
import { readSample } from '../helpers/samples';

/** AC61: the investor path model is deterministic (5 fresh runs byte-equal). */
const FIXTURES = [
  'investor-path-dead-end/clean.html',
  'investor-path-dead-end/skips-signature.html',
  'investor-path-missing-item/part-c.html',
  'investor-path-missing-item/peer-item.html',
];

describe('investor-path-determinism (AC61)', () => {
  it('should list the same investor paths on every run', () => {
    for (const rel of FIXTURES) {
      const html = readFileSync(
        new URL(`../../../../fixtures/html-seeded/${rel}`, import.meta.url),
        'utf8',
      );
      const runs = Array.from({ length: 5 }, () =>
        JSON.stringify(investorModel(analyzeHtml(html))),
      );
      for (const r of runs) expect(r, rel).toBe(runs[0]);
    }
  });

  it.each([1, 3, 10, 12])('sample #%i: 5 runs give byte-equal paths', (n) => {
    const bytes = readSample(n);
    const runs = Array.from({ length: 5 }, () => JSON.stringify(investorModel(analyzeHtml(bytes))));
    for (const r of runs) expect(r).toBe(runs[0]);
  });
});
