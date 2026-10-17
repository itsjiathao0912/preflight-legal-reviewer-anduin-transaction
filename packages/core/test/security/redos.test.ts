import { describe, expect, it } from 'vitest';
import * as conditionals from '../../src/structure/conditionals';
import * as definedTerms from '../../src/structure/defined-terms';
import * as references from '../../src/structure/references';
import * as statutory from '../../src/structure/statutory';
import { ACCOUNT_NUMBER_RE } from '../../src/memory/mask';
import { OFFERING_CONTEXT_RE, CARVE_OUT_RE } from '../../src/detectors/undefined-term';
import { NOISE_RULES, GLYPH_RULES, EXCLUSIVITY_CUES } from '../../src/adapters/html';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import * as flagDraftingNote from '../../src/detectors/flag-drafting-note';
import * as flagPlaceholder from '../../src/detectors/flag-placeholder';
import * as flagSensitive from '../../src/detectors/flag-sensitive';
import * as optionGapOverlap from '../../src/detectors/option-gap-overlap';
import * as definedTermIssues from '../../src/detectors/defined-term-issues';
import * as flow from '../../src/detectors/flow';
import * as unreachableFlow from '../../src/detectors/unreachable-flow';
import * as investorPaths from '../../src/investor/paths';
import { TYPE_RULES } from '../../src/investor/types';
import { htmlSamples, readSample } from '../helpers/samples';
import * as pageNoise from '../../src/adapters/page-noise';
import * as pdfText from '../../src/adapters/pdf-text';
import * as formatDetect from '../../src/adapters/format-detect';

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
  // Phase 02 detectors
  insertOpen: fill('[insert '),
  bullets: fill('[● '),
  ntd: fill('NTD NTD: '),
  abaCue: fill('ABA routing: # '),
  money: fill('$1,000,000 to '),
  ibanLike: fill('GB82 WEST '),
  capsDigits: fill('ABCD123'),
  ofSection: fill(' of Section '),
  asDefined: fill('Fund (as defined '),
  // Phase 06 page-noise / PDF
  pageOf: fill('Page 1 of '),
  slashes: fill('1 / '),
  dashDigits: fill('- 1 - '),
  tabsSpaces: fill(' \t '),
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
  // Phase 02: every new detector regex + the widened ACCOUNT_NUMBER_RE (above)
  ...collect(flagDraftingNote),
  ...collect(flagPlaceholder),
  ...collect(flagSensitive),
  ...collect(optionGapOverlap),
  ...collect(definedTermIssues),
  ...collect(flow),
  ...collect(unreachableFlow),
  ...collect(investorPaths),
  ...TYPE_RULES.map((r) => r.re),
];

// Phase 06 (D7): page-noise, pdf-text and format-detect regexes.
const PHASE06: RegExp[] = [...collect(pageNoise), ...collect(pdfText), ...collect(formatDetect)];
ALL.push(...PHASE06);

function scan(re: RegExp, text: string): number {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let n = 0;
  for (const _ of text.matchAll(g)) n++;
  return n;
}

describe('redos-budget', () => {
  it('should bound every page-noise regex', () => {
    expect(collect(pageNoise).length).toBeGreaterThanOrEqual(4);
    expect(PHASE06.every((re) => ALL.includes(re))).toBe(true);
    for (const re of PHASE06) {
      for (const [name, text] of Object.entries(ADVERSARIAL)) {
        const t0 = performance.now();
        scan(re, text);
        expect(performance.now() - t0, `${re.source.slice(0, 40)} on ${name}`).toBeLessThan(2000);
      }
    }
    const t0 = performance.now();
    pageNoise.stripPageNoise(
      Array.from({ length: 30 }, (_, p) =>
        Array.from({ length: 200 }, (_, i) => ({
          text: i % 2 ? ADVERSARIAL.pageOf!.slice(0, 4000) : `${'1 / '.repeat(500)}`,
          cue: { bold: false, caps: false, indent: 0, position: 'left' as const },
          page: p + 1,
        })),
      ),
    );
    expect(performance.now() - t0).toBeLessThan(5000);
  });

  it('collects every exported regex (sanity)', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(45);
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
