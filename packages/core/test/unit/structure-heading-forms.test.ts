import { describe, expect, it } from 'vitest';
import { htmlToLines } from '../../src/adapters/html';
import {
  KEYWORD_SECTION_RE,
  keywordSectionCandidate,
  romanToInt,
  sectionCandidate,
} from '../../src/structure/headings';
import { structure } from '../../src/structure/structurer';
import type { Line } from '../../src/model/types';

/** AC-S1 (intake T14): keyword-led Section / Article headings. */
const line = (text: string, bold = false): Line =>
  ({ text, cue: { bold, caps: false } }) as unknown as Line;

const run = (html: string) => {
  const r = htmlToLines(html);
  return structure(r.docHash, r.lines);
};
const sections = (html: string) =>
  run(html).scopes.flatMap((s) => s.sections.map((x) => `${x.number}|${x.title}`));

describe('structure-heading-forms (AC-S1)', () => {
  it('should accept Section N. and Article roman headings without bold or caps', () => {
    const cases: Array<[string, string, number, string]> = [
      ['Section 4. Investor Representations', '4', 4, 'Investor Representations'],
      ['SECTION 4', '4', 4, ''],
      ['Section 4', '4', 4, ''],
      ['Section 4 Transfer Restrictions', '4', 4, 'Transfer Restrictions'],
      ['Article 4.', '4', 4, ''],
      ['ARTICLE 4 DEFINITIONS', '4', 4, 'DEFINITIONS'],
      ['Article I.', '1', 1, ''],
      ['Article XII. Miscellaneous Provisions', '12', 12, 'Miscellaneous Provisions'],
      ['Section 4A. Additional Terms', '4A', 4, 'Additional Terms'],
    ];
    for (const [text, number, num, title] of cases) {
      const c = sectionCandidate(line(text));
      expect(c, text).not.toBeNull();
      expect([c!.number, c!.num, c!.title, c!.titleOk]).toEqual([number, num, title, true]);
    }
  });

  it('converts roman I..XX and rejects non-canonical numerals', () => {
    const romans = 'I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX'.split(
      ' ',
    );
    romans.forEach((r, i) => {
      expect(romanToInt(r)).toBe(i + 1);
      expect(keywordSectionCandidate(line(`Article ${r}. Title`))?.number).toBe(String(i + 1));
    });
    expect(romanToInt('IIII')).toBeNull();
    expect(romanToInt('VX')).toBeNull();
    expect(keywordSectionCandidate(line('Section IV. Title'))).toBeNull();
  });

  it('should reject Section N: instruction lines, dotted decimals, lowercase roman and Article IV of the Agreement prose', () => {
    const negatives = [
      'Section 3 of the Act applies to the offering',
      'Section 4975 of the Code',
      'Section 3(42) of ERISA',
      'Section 4 shall survive the closing',
      'Section 2: Print the name of the investor.',
      'Article iv. Title',
      'Article IV of the Agreement governs transfers',
      'Section 1.1 Title.',
      'Section 1.1 Defined Terms',
      'The investor completes Section 4. Title',
      `Section 4. ${'Long title words '.repeat(8)}`,
      'Section 4. The Investor shall deliver the documents.',
    ];
    for (const t of negatives) expect(sectionCandidate(line(t)), t).toBeNull();
  });

  it('keeps the existing N. Title rule unchanged (bold or caps still required there)', () => {
    expect(sectionCandidate(line('4. Investor Information', true))?.titleOk).toBe(true);
    expect(sectionCandidate(line('4. Investor Information', false))?.titleOk).toBe(false);
    expect(sectionCandidate(line('1.1 Title', true))).toBeNull();
  });

  it('builds sections from plain keyword-led headings with the accept rules (next, gap, letter)', () => {
    const html = [
      'Section 1. Definitions',
      'Body text one.',
      'Section 2. Subscription',
      'Section 2A. Extra Terms',
      'Section 5. Gap Section',
      'Section 4 of the Act applies here.',
      'Section 6. Miscellaneous',
    ]
      .map((t) => `<p>${t}</p>`)
      .join('');
    expect(sections(`<html><body>${html}</body></html>`)).toEqual([
      '1|Definitions',
      '2|Subscription',
      '2A|Extra Terms',
      '5|Gap Section',
      '6|Miscellaneous',
    ]);
  });

  it('builds Article sections with roman numbers in sequence', () => {
    const html = [
      'Article I. Definitions',
      'Section 1.1 Defined Terms. Words.',
      'Article II. Admission',
      'Article III. Capital',
    ]
      .map((t) => `<p>${t}</p>`)
      .join('');
    expect(sections(`<html><body>${html}</body></html>`)).toEqual([
      '1|Definitions',
      '2|Admission',
      '3|Capital',
    ]);
  });

  it('E9: a bold keyword-led line naming Instructions opens a scope, not a section (measured)', () => {
    const s = run('<html><body><p><b>Section 3. Instructions</b></p><p>Text.</p></body></html>');
    expect(s.scopes.map((x) => x.kind)).toEqual(['body', 'instructions']);
    expect(s.scopes.flatMap((x) => x.sections)).toHaveLength(0);
  });

  it('should finish the heading regex on 100000-char hostile lines under the time bound', () => {
    const hostile = [
      '1'.repeat(100_000),
      'Section '.repeat(12_500),
      'Section ' + 'IVXL'.repeat(25_000),
      'Article I' + ' '.repeat(100_000) + 'x',
      'Section 4. ' + 'A'.repeat(100_000) + '.',
    ];
    const t0 = performance.now();
    for (const h of hostile) {
      KEYWORD_SECTION_RE.exec(h);
      sectionCandidate(line(h));
    }
    expect(performance.now() - t0).toBeLessThan(500);
  });
});
