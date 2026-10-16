import { describe, expect, it } from 'vitest';
import * as conditionals from '../../src/structure/conditionals';
import * as definedTerms from '../../src/structure/defined-terms';
import * as references from '../../src/structure/references';
import * as statutory from '../../src/structure/statutory';
import { ACCOUNT_NUMBER_RE } from '../../src/memory/mask';
import { OFFERING_CONTEXT_RE, CARVE_OUT_RE } from '../../src/detectors/undefined-term';
import { NOISE_RULES, GLYPH_RULES, EXCLUSIVITY_CUES } from '../../src/adapters/html';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { htmlSamples, readSample } from '../helpers/samples';

/** redos-budget: every heading/reference/statutory/detector regex on the largest sample and on 1 MB adversarial single lines. */
const MB = 1024 * 1024;
const fill = (s: string) => s.repeat(Math.ceil(MB / s.length)).slice(0, MB);
const ADVERSARIAL: Record<string, string> = {
  sections: fill('Section '),
  digits: fill('1234567890'),
  parens: fill('(a)'),
  spaces: fill(' '),
  unterminatedQuote: '“' + fill('A'),
  unterminatedParen: '(' + fill('x '),
  partOf: fill('Part B of Section 6 of the '),
  thisSection: fill('this Section 1'),
  ifComplete: fill('if you complete '),
  forFor: fill('for for '),
  capsWords: fill('Abc '),
  digitsDash: fill('1-2 '),
};

const HEADING_RES: RegExp[] = [
  /^\s*(\d{1,2}[A-Z]?)\.(?:\s+(.*))?$/,
  /^\s*Part\s+([A-Z])\b\s*(?:[–—:-]\s*)?(.*)$/i,
  /^\s*\(?(\d{1,2}[A-Z]?)[.)]\s/,
];

function collect(mod: Record<string, unknown>): RegExp[] {
  return Object.values(mod).filter((v): v is RegExp => v instanceof RegExp);
}

const ALL: RegExp[] = [
  ...collect(references),
  ...collect(statutory),
  ...collect(definedTerms),
  ...collect(conditionals),
  ACCOUNT_NUMBER_RE,
  OFFERING_CONTEXT_RE,
  CARVE_OUT_RE,
  ...NOISE_RULES.map((r) => r.pattern),
  ...GLYPH_RULES.map((r) => r.from),
  ...EXCLUSIVITY_CUES,
  ...HEADING_RES,
];

function scan(re: RegExp, text: string): number {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let n = 0;
  for (const _ of text.matchAll(g)) n++;
  return n;
}

describe('redos-budget', () => {
  it('collects every exported regex (sanity)', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(25);
  });

  it(
    'should complete regex scans on a 1 MB single line within budget',
    { timeout: 120_000 },
    () => {
      const slow: string[] = [];
      for (const re of ALL) {
        for (const [name, text] of Object.entries(ADVERSARIAL)) {
          const t0 = performance.now();
          scan(re, text);
          const ms = performance.now() - t0;
          if (ms > 2000) slow.push(`${re.source.slice(0, 50)} on ${name}: ${ms.toFixed(0)} ms`);
        }
      }
      expect(slow).toEqual([]);
    },
  );

  it('every regex on the largest sample stays under budget', () => {
    const largest = htmlSamples()
      .map((f) => ({ f, b: readSample(f) }))
      .sort((a, b) => b.b.byteLength - a.b.byteLength)[0]!;
    const text = new TextDecoder().decode(largest.b);
    for (const re of ALL) {
      const t0 = performance.now();
      scan(re, text);
      expect(performance.now() - t0).toBeLessThan(2000);
    }
  });

  it(
    'the full pipeline on 1 MB adversarial single-line HTML does not throw and stays under budget',
    { timeout: 60_000 },
    () => {
      for (const [name, text] of Object.entries(ADVERSARIAL)) {
        const t0 = performance.now();
        const g = analyzeHtml(`<p>${text}</p>`);
        runDeterministic(g);
        const ms = performance.now() - t0;
        expect(ms, name).toBeLessThan(10_000);
      }
    },
  );
});
