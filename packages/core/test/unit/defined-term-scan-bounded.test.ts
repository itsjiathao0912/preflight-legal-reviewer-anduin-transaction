import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import {
  buildWordIndex,
  candidateBlocks,
  termIssues,
  type TermScanStats,
} from '../../src/detectors/defined-term-issues';
import { analyzed } from '../helpers/samples';

/** F4: the defined-term scans touch only blocks holding the term's first word (no terms x blocks sweep). */
function bigDoc(terms: number, filler: number): string {
  const defs = Array.from(
    { length: terms },
    (_, i) => `<p>The holder of record (the &ldquo;Holder${i} Party&rdquo;) signs here.</p>`,
  ).join('');
  const body = Array.from(
    { length: filler },
    (_, i) => `<p>Filler paragraph ${i} describes the subscription process in plain words.</p>`,
  ).join('');
  return `<html><body><p><b>1. TERMS</b></p>${defs}${body}<p>Holder3 Party and holder7 Party sign.</p></body></html>`;
}

describe('defined-term-scan-bounded (F4)', () => {
  it('scans O(occurrences) blocks, not terms x blocks', () => {
    const terms = 60;
    const filler = 1500;
    const g = analyzeHtml(bigDoc(terms, filler));
    const stats: TermScanStats = { blocksScanned: 0 };
    const issues = termIssues(g, stats);
    const blocks = g.structure.blocks.length;
    expect(stats.blocksScanned).toBeGreaterThan(0);
    expect(blocks).toBeGreaterThan(filler);
    // naive scan would be >= terms * blocks for the unused check alone
    expect(stats.blocksScanned).toBeLessThan(terms * 10);
    expect(stats.blocksScanned).toBeLessThan((terms * blocks) / 100);
    // results still correct: Holder3 is used, Holder7 has a capitalization variant, the rest unused
    const unused = issues.filter((i) => i.kind === 'unused').map((i) => i.term);
    expect(unused).not.toContain('Holder3 Party');
    expect(unused).toContain('Holder0 Party');
    expect(issues.some((i) => i.kind === 'capitalization')).toBe(false); // "holder7" is all lower: ignored
  });

  it('candidateBlocks matches the full-scan semantics of \\bTerm\\b', () => {
    const texts = ['The Units, and U.S. Person', 'units only', 'Unitsx', '(Units)'];
    const idx = buildWordIndex(texts);
    expect(candidateBlocks(idx, 'Units', false)).toEqual([0, 3]);
    expect(candidateBlocks(idx, 'Units', true)).toEqual([0, 1, 3]);
    expect(candidateBlocks(idx, 'U.S. Person', false)).toEqual([0]);
    expect(candidateBlocks(idx, '"Odd"', false)).toBeNull();
    for (const [term, ci] of [
      ['Units', false],
      ['Units', true],
      ['U.S. Person', false],
    ] as const) {
      const re = new RegExp(`\\b${term.replace(/[.]/g, '\\.')}\\b`, ci ? 'i' : '');
      const full = texts.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
      for (const i of full) expect(candidateBlocks(idx, term, ci)).toContain(i);
    }
  });

  it('golden counts stay: #1=2, #3=2, #5=2, #11=1', () => {
    const counts = [1, 3, 5, 11].map((n) => {
      const { g } = analyzed(n);
      return runDeterministic(g).filter((f) =>
        ['ref-this-section', 'ref-label-coherence', 'undefined-term'].includes(f.detector_id),
      ).length;
    });
    expect(counts).toEqual([2, 2, 2, 1]);
  });
});
