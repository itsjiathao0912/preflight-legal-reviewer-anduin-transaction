import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { annexLabels, parseTarget, questionNumbers } from '../../src/detectors/flow';

/** AC-S2 (intake T14): Annex X and Question N conditional targets. */
const doc = (paras: string[]) =>
  analyzeHtml(`<html><body>${paras.map((p) => `<p>${p}</p>`).join('')}</body></html>`);
const broken = (paras: string[]) =>
  runDeterministic(doc(paras)).filter((f) => f.detector_id === 'broken-conditional');

const BPI = 'If the Investor is a Benefit Plan Investor, complete Annex F.';
const questions = (n: number) =>
  Array.from({ length: n }, (_, i) => `Question ${i + 1}. State item ${i + 1} here`);

describe('broken-conditional-annex-question (AC-S2)', () => {
  it('parses typed Annex and Question targets', () => {
    expect(parseTarget('Annex F')).toEqual({ raw: 'Annex F', parts: [], annex: 'F' });
    expect(parseTarget('Question 15')).toEqual({ raw: 'Question 15', parts: [], question: 15 });
    expect(parseTarget('Section 4')).toEqual({ raw: 'Section 4', section: '4', parts: [] });
  });

  it('should flag complete Annex F when no Annex F block exists and stay silent when it does', () => {
    const base = [
      'Body text.',
      BPI,
      'Annex A. Investor Questionnaire',
      'Annex B. Wire Instructions',
    ];
    const f = broken(base);
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe('critical');
    expect(f[0]!.detail.facts.missing).toBe('Annex F');
    expect(f[0]!.quote).toContain('complete Annex F');
    expect(broken([...base, 'Annex F. ERISA Representations'])).toHaveLength(0);
  });

  it('E10: annex labels need no trailing period (Annex D: and Annex F. both count)', () => {
    expect(
      [...annexLabels(doc(['Annex D: Wire', 'Annex F. ERISA', 'ANNEX A']).structure.blocks)].sort(),
    ).toEqual(['A', 'D', 'F']);
    expect(
      broken(['If the Investor is a bank, complete Annex D.', 'Annex D: Wire details']),
    ).toHaveLength(0);
  });

  it('should flag skip to Question 15 with 14 questions numbered across Parts and stay silent with 15', () => {
    const q = questions(14);
    q.splice(
      7,
      0,
      'If you answered Yes to Question 6 (Benefit Plan Investor), skip to Question 15.',
    );
    const paras = [
      'Annex A. Investor Questionnaire',
      'Part 1',
      ...q.slice(0, 5),
      'Part 2',
      ...q.slice(5),
      'Annex B. ERISA',
    ];
    const g = doc(paras);
    expect(questionNumbers(g.structure.blocks, 8).size).toBe(14);
    const f = broken(paras);
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.facts.missing).toBe('Question 15');
    expect(f[0]!.severity).toBe('critical');
    const q15 = [...paras.slice(0, -1), 'Question 15. Final item here', 'Annex B. ERISA'];
    expect(broken(q15)).toHaveLength(0);
  });

  it('should stay uncertain with no annex or question evidence', () => {
    expect(broken(['Body text.', BPI])).toHaveLength(0);
    expect(broken(['If you answered Yes, skip to Question 15.', 'More text.'])).toHaveLength(0);
  });

  it('keeps Section targets unchanged and emits one finding per instruction', () => {
    const paras = [
      '<b>1. TERMS</b>',
      '<b>2. INVESTOR</b>',
      'If the Investor is a trust, complete Section 9 and Annex F.',
      'Annex A. Questionnaire',
    ];
    const f = broken(paras);
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.facts.missing).toBe('Section 9');
  });
});
