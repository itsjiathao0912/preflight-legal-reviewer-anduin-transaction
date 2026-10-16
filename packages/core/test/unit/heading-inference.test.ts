import { describe, expect, it } from 'vitest';
import { htmlToLines, styleWeight } from '../../src/adapters/html';
import { structure } from '../../src/structure/structurer';
import { sectionCandidate, stripTitleNoise } from '../../src/structure/headings';

const run = (html: string) => {
  const r = htmlToLines(html);
  return { lines: r.lines, s: structure(r.docHash, r.lines) };
};

describe('heading inference (Pinned Algorithm H)', () => {
  it('reads bold from <b>/<strong> and from inline CSS (font-weight, font shorthand)', () => {
    expect(styleWeight('font-weight: bold')).toBe(true);
    expect(styleWeight('FONT-WEIGHT:700')).toBe(true);
    expect(styleWeight('font: bold 11pt Times New Roman')).toBe(true);
    expect(styleWeight('font: 10pt Times')).toBe(false);
    expect(styleWeight('font-weight: normal')).toBe(false);
    expect(styleWeight('color: red')).toBeUndefined();
    const { lines } = run(
      '<p><b>1.</b> <strong>TITLE</strong></p><p style="font-weight:600">2. Second</p>',
    );
    expect(lines.map((l) => l.cue.bold)).toEqual([true, true]);
  });

  it('nearest declaration wins: inner font-weight:normal cancels an outer table bold (E1 text before "(")', () => {
    const html =
      '<table style="font: bold 11pt Times"><tr><td>4.</td><td>CUSTODIAN INFORMATION <font style="font-weight: normal">(if applicable)</font></td></tr>' +
      '<tr><td style="font-weight: normal">some normal row text here</td></tr></table>' +
      '<p style="font: bold 10pt Times">Part B &ndash; Investment amount <font style="font-weight: normal">(please consult with your Financial Advisor and the Prospectus for applicable minimums and fees)</font></p>';
    const { lines } = run(html);
    expect(lines[0]!.text).toBe('4. CUSTODIAN INFORMATION (if applicable)');
    expect(lines[0]!.cue.bold).toBe(true);
    expect(lines[0]!.cue.caps).toBe(true);
    expect(lines[1]!.cue.bold).toBe(false);
    expect(lines[2]!.cue.bold).toBe(true);
  });

  it('a font shorthand without bold resets weight (E4)', () => {
    const { lines } = run(
      '<div style="font-weight:bold"><p style="font: 10pt Arial">plain text</p></div>',
    );
    expect(lines[0]!.cue.bold).toBe(false);
  });

  it('merges all cells of a row before heading scoring', () => {
    const { lines, s } = run(
      '<table><tr><td><b>12.</b></td><td><b>Qualified Client Status</b> (must be completed)</td></tr></table>',
    );
    expect(lines).toHaveLength(1);
    expect(s.scopes[0]!.sections.map((x) => `${x.number}:${x.title}`)).toEqual([
      '12:Qualified Client Status (must be completed)',
    ]);
  });

  it('caps is computed on the title minus parentheticals and a trailing *', () => {
    expect(stripTitleNoise('FINANCIAL ADVISOR INFORMATION* (if applicable)')).toBe(
      'FINANCIAL ADVISOR INFORMATION',
    );
    const c = sectionCandidate({
      text: '5. FINANCIAL ADVISOR INFORMATION* (if applicable)',
      cue: { bold: false, caps: false, indent: 0, position: 'unknown' },
    });
    expect(c?.titleOk).toBe(true);
  });

  it('non-bold "N." lines are list items; a 1-22 sub-list inside a section stays inert', () => {
    const items = Array.from(
      { length: 22 },
      (_, i) => `<p>${i + 1}. The investor is a natural person who meets test ${i + 1}.</p>`,
    ).join('');
    const { s } = run(
      `<p><b>11. Accredited Investor Status</b></p>${items}<p><b>12. Qualified Client Status</b></p><p>1. The investor is something.</p>`,
    );
    expect(s.scopes.flatMap((x) => x.sections).map((x) => x.number)).toEqual(['11', '12']);
    expect(s.blocks.filter((b) => b.kind === 'list_item')).toHaveLength(23);
  });

  it('an Acknowledgments 1-13 list before the first bold section never sets main-scope numbering', () => {
    const ack = Array.from(
      { length: 13 },
      (_, i) => `<p>${i + 1}. I acknowledge item ${i + 1} of the agreement.</p>`,
    ).join('');
    const { s } = run(
      `<p><b>Acknowledgments</b></p>${ack}<p><b>1. Investment</b></p><p><b>2. Investment Instructions</b></p>`,
    );
    expect(s.scopes.flatMap((x) => x.sections).map((x) => x.number)).toEqual(['1', '2']);
    expect(s.info.slice(1, 14).every((i) => i.section === undefined)).toBe(true);
  });

  it('monotonic numbers: a bold heading with a +2 gap is accepted (non-cascading), a backwards number is demoted', () => {
    const { s } = run(
      '<p><b>1. One</b></p><p><b>2. Two</b></p><p><b>4. Four</b></p><p><b>5. Five</b></p><p><b>3. Three again</b></p>',
    );
    const secs = s.scopes.flatMap((x) => x.sections);
    expect(secs.map((x) => x.number)).toEqual(['1', '2', '4', '5']);
    expect(secs.find((x) => x.number === '4')!.gap).toBe(true);
    expect(s.blocks[4]!.kind).toBe('list_item');
  });

  it('scope openers (Instructions, Terms and Conditions, Signature Pages, Appendix) start new numbering scopes', () => {
    const { s } = run(
      '<p><b>SUBSCRIPTION AGREEMENT INSTRUCTIONS</b></p><p><b>1. Read</b></p><p><b>2. Complete</b></p>' +
        '<p><b>SUBSCRIPTION AGREEMENT SIGNATURE PAGES</b></p><p><b>1. TYPE OF ACCOUNT</b></p><p><b>APPENDIX A</b></p><p><b>1. Definitions</b></p>',
    );
    expect(s.scopes.map((x) => x.kind)).toEqual(['body', 'instructions', 'signature', 'appendix']);
    expect(s.scopes.map((x) => x.sections.length)).toEqual([0, 2, 1, 1]);
    expect(new Set(s.scopes.map((x) => x.id)).size).toBe(4);
  });

  it('Part X inside a section is a part child (separator optional, label up to "(")', () => {
    const { s } = run(
      '<p><b>6. INVESTMENT DETAILS</b></p><p><b>Part A &ndash; Share class</b> (please select)</p><p><b>Part B Investment amount</b></p>',
    );
    const s6 = s.scopes[0]!.sections[0]!;
    expect(s6.parts.map((p) => `${p.letter}:${p.label}`)).toEqual([
      'A:Share class',
      'B:Investment amount',
    ]);
  });

  it('unknown heading style is a plain paragraph, never a throw', () => {
    const { s } = run(
      '<div class="weird"><span>Something odd</span></div><p></p><table><tr></tr></table>',
    );
    expect(s.blocks.map((b) => b.kind)).toEqual(['paragraph']);
    expect(s.blocks[0]!.lines[0]!.cue.cue_source).toBe('class');
  });
});
