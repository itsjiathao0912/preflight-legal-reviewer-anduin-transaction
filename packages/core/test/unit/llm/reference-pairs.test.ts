import { describe, expect, it } from 'vitest';
import { limits } from '../../../src/config/limits';
import { AiRequestSchema } from '../../../src/contracts/ai';
import { analyzeHtml, runDeterministic } from '../../../src/engine';
import {
  MAX_TARGETS_PER_PAIR,
  POINTER_MAX_CHARS,
  buildReferencePairs,
  letteredHeadings,
} from '../../../src/llm/reference-pairs';

const doc = (body: string) => `<html><body>${body}</body></html>`;
const pairsOf = (html: string, max?: number) => {
  const g = analyzeHtml(html);
  return { g, ...buildReferencePairs(g, runDeterministic(g), max) };
};
const siteText = (
  g: ReturnType<typeof analyzeHtml>,
  s: { blockIndex: number; start: number; end: number },
) =>
  g.structure.blocks[s.blockIndex]!.lines.map((l) => l.text)
    .join(' ')
    .slice(s.start, s.end);

// Onex shape: directions list, later label-plus-title paragraphs A. to G. under a signature page
const ONEX = doc(`
<h2>3. Investor Questionnaire:</h2>
<ol>
<li>(d) Each Investor should respond to the questions in Section D.</li>
<li>(e) Each Investor who is a natural person should respond to Section E.</li>
</ol>
<h2>SIGNATURE PAGE</h2>
<p>C. Non-U.S. Persons</p><p>Each Investor that is not a U.S. Person must answer the following.</p>
<p>D. Type of Individual or Entity</p><p>Check the box that describes the Investor.</p>
<p>E. Supplemental Data for Entities</p>
<p>1. If the Investor is not a natural person, furnish the following supplemental data.</p>
<p>G. Supplemental Data for Individuals</p><p>Natural persons answer these questions.</p>
`);

// LAGO shape: bare "A." block plus title block; one-paragraph G./H./I. headings; a NOTE naming G and H
const LAGO = doc(`
<h2>SUBSCRIPTION INSTRUCTIONS</h2>
<p>A.</p><p>PLEASE PROVIDE THE FOLLOWING INFORMATION.</p>
<p>Name of Investor and mailing address of the Investor.</p>
<p>NOTE: Only Benefit Plan Investors need to complete the following Section G, all other Investors should proceed to Section H.</p>
<p>G. THE FOLLOWING INFORMATION IS TO BE PROVIDED SO THAT THE COMPANY CAN DETERMINE BENEFIT PLAN PARTICIPATION.</p>
<p>The Company will use reasonable best efforts to operate as a venture capital operating company.</p>
<p>H. THE FOLLOWING INFORMATION IS TO BE PROVIDED BY INVESTORS WHO ARE PENSION OR OTHER EMPLOYEE BENEFIT PLANS OR IRAs.</p>
<p>1. I confirm that the decision to invest is the decision of the undersigned plan fiduciary.</p>
<p>I. cash Distribution information</p><p>Provide wire instructions for distributions.</p>
`);

// Keystone shape: PART X: heading blocks, four PART D headings, repeated Part A headings
const KEYSTONE = doc(`
<h2>Part A: General Information &amp; SUBSTITUTE W-9 FORM</h2><p>Individual investor details.</p>
<h2>Part A: General Information &amp; SUBSTITUTE W-9 FORM</h2><p>Entity investor details.</p>
<h2>PART B: DISTRIBUTION INSTRUCTIONS</h2><p>Choose cash or reinvestment.</p>
<h2>PART C: SUBSCRIPTION AGREEMENT</h2>
<p>TO: Keystone Private Income Fund, Milwaukee, WI 53212.</p>
<ol><li>(6) The information provided in Part C of the Suitability Statement, if the Subscriber is a natural person or alter-ego thereof, or Part D of the Suitability Statement, if the Subscriber is an entity, is true and accurate as of the date hereof.</li></ol>
<h2>PART D: SUITABILITY STATEMENTS FOR INDIVIDUAL INVESTORS</h2><p>The Investor is an individual.</p>
<h2>PART D: SUITABILITY STATEMENTS FOR RETIREMENT ACCOUNTS</h2><p>The Investor is a retirement account.</p>
<h2>PART D: SUITABILITY STATEMENTS FOR REVOCABLE GRANTOR TRUSTS</h2><p>The Investor is a trust.</p>
<h2>PART D: SUITABILITY STATEMENTS FOR ENTITY INVESTORS</h2><p>The Investor is an entity.</p>
<h2>PART E: ADDITIONAL SUBSCRIPTION REQUEST</h2><p>Additional purchases.</p>
`);

const find = <T extends { quote: string }>(cs: T[], s: string) =>
  cs.find((c) => c.quote.includes(s));

describe('reference-pairs (AC1 to AC4, AC6)', () => {
  it('AC1: Onex pair has the natural-person Section E pointer and the Section E heading in TARGET', () => {
    const { g, candidates, sites } = pairsOf(ONEX);
    const c = find(candidates, 'natural person should respond to Section E');
    expect(c).toBeDefined();
    expect(
      c!.quote.startsWith('(e) Each Investor who is a natural person should respond to Section E.'),
    ).toBe(true);
    expect(c!.quote).toContain(
      '[TARGET Section E: Supplemental Data for Entities | 1. If the Investor is not a natural person',
    );
    expect(c!.issue_class_hint).toBe('broken_cross_reference');
    const site = sites.find((s) => s.id === c!.id)!;
    expect(siteText(g, site)).toBe(
      '(e) Each Investor who is a natural person should respond to Section E.',
    );
  });

  it('AC2: LAGO pair shows the plan-only Section H heading and the Section G heading', () => {
    const { candidates } = pairsOf(LAGO);
    const c = find(candidates, 'proceed to Section H')!;
    expect(c).toBeDefined();
    const targets = c.quote.split('\n').slice(1);
    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatch(
      /^\[TARGET Section G: THE FOLLOWING INFORMATION IS TO BE PROVIDED SO THAT/,
    );
    expect(targets[1]).toMatch(
      /^\[TARGET Section H: THE FOLLOWING INFORMATION IS TO BE PROVIDED BY INVESTORS WHO ARE PENSION/,
    );
  });

  it('resolver accepts a bare label block with the title in the next block', () => {
    const e = letteredHeadings(analyzeHtml(LAGO)).find((x) => x.label === 'A')!;
    expect(e.title).toBe('PLEASE PROVIDE THE FOLLOWING INFORMATION.');
    expect(e.family).toBe('section');
  });

  it('AC3: Keystone Part C TARGET is the subscription agreement heading, never a Part D heading', () => {
    const { candidates } = pairsOf(KEYSTONE);
    const c = find(candidates, 'Part C of the Suitability Statement')!;
    expect(c).toBeDefined();
    const [, tc, td] = c.quote.split('\n');
    expect(tc).toMatch(/^\[TARGET Part C: SUBSCRIPTION AGREEMENT/);
    expect(tc).not.toContain('SUITABILITY STATEMENTS');
    // four duplicate PART D headings: no same-scope entry, so the first one is picked
    expect(td).toMatch(/^\[TARGET Part D: SUITABILITY STATEMENTS FOR INDIVIDUAL INVESTORS/);
    expect(letteredHeadings(analyzeHtml(KEYSTONE)).filter((x) => x.label === 'D')).toHaveLength(4);
  });

  it('AC4: duplicate label picks the entry in the pointer scope; nested field labels never shadow', () => {
    const html = doc(`
<h2>1. Restrictions</h2>
<p>I. Bad Actor Disqualification</p><p>Bad actor questions.</p>
<h2>2. DISCRETIONARY MANAGEMENT</h2>
<p>Please complete Section I below before signing.</p>
<p>I. Third Party Referrals</p><p>Referral questions.</p>
`);
    const { candidates } = pairsOf(html);
    const c = find(candidates, 'complete Section I')!;
    expect(c.quote).toContain('[TARGET Section I: Third Party Referrals');
    expect(letteredHeadings(analyzeHtml(html)).filter((x) => x.label === 'I')).toHaveLength(2);
  });

  it('AC4: NOT FOUND when no heading has the label', () => {
    const { candidates } = pairsOf(ONEX.replace('Section E.', 'Section F.'));
    const c = find(candidates, 'should respond to Section F')!;
    expect(c.quote).toContain('[TARGET Section F: NOT FOUND]');
  });

  it('AC4: packing: at most 1000 chars with the pointer as exact prefix, 3 targets max, stable ids, cap', () => {
    const long = 'x'.repeat(60);
    const heads = ['A', 'B', 'C', 'D', 'E']
      .map(
        (l) =>
          `<p>${l}. HEADING ${l} ${'WORD '.repeat(60)}</p><p>${'Body text sentence. '.repeat(60)}</p>`,
      )
      .join('');
    const pointer = `Each Investor ${long} should complete Sections A, B, C and D and then proceed to Section E as instructed in these directions.`;
    const ptrs = Array.from(
      { length: 50 },
      (_, i) => `<li>(${i}) ${pointer.replace('Investor', `Investor${i}`)}</li>`,
    ).join('');
    const html = doc(`<ol>${ptrs}</ol>${heads}`);
    const r = pairsOf(html);
    expect(r.candidates).toHaveLength(limits.aiCandidates);
    for (const c of r.candidates) {
      expect(c.quote.length).toBeLessThanOrEqual(limits.quoteMaxChars);
      const lines = c.quote.split('\n');
      expect(lines.length - 1).toBeLessThanOrEqual(MAX_TARGETS_PER_PAIR);
      expect(lines[0]!.length).toBeLessThanOrEqual(POINTER_MAX_CHARS);
      const site = r.sites.find((s) => s.id === c.id)!;
      expect(siteText(r.g, site).startsWith(lines[0]!)).toBe(true);
      expect(c.id).toMatch(/^r_[0-9a-f]{16}$/);
    }
    expect(pairsOf(html).candidates).toEqual(r.candidates);
    expect(new Set(r.candidates.map((c) => c.id)).size).toBe(r.candidates.length);
    expect(pairsOf(html, 2).candidates).toHaveLength(2);
    expect(pairsOf(html, 0).candidates).toEqual([]);
    expect(
      AiRequestSchema.safeParse({
        v: 1,
        task: 'reference-target',
        law_firm_id: null,
        candidates: r.candidates,
        settings: {},
      }).success,
    ).toBe(true);
  });

  it('AC4: the packed string stays within budget without the final slice', () => {
    const heads = ['A', 'B', 'C']
      .map((l) => `<p>${l}. ${'TITLE '.repeat(80)}</p><p>${'Excerpt words here. '.repeat(80)}</p>`)
      .join('');
    const pointer = `Each Investor ${'very '.repeat(150)}long should complete Sections A, B and C.`;
    const { candidates } = pairsOf(doc(`<ol><li>${pointer}</li></ol>${heads}`));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.quote.length).toBeLessThan(limits.quoteMaxChars);
    expect(candidates[0]!.quote.split('\n')).toHaveLength(4);
  });

  it('AC6: no pairs for statute or CFR citations, W-8 Part V and defined-by-reference terms', () => {
    const html = doc(`
<p>A. General Information</p><p>Investor details.</p>
<p>V. Other</p><p>Other details.</p>
<p>The Fund relies on Section 3(c)(7) of the Investment Company Act.</p>
<p>See Code Sections 414(d), 892 and 4975 and Rule 506(b) under the Securities Act and 29 C.F.R. Section 2510.3-101.</p>
<p>Non-U.S. investors must complete Part V of Form W-8BEN-E.</p>
<p>Capitalized terms have the meaning given in the Memorandum, the PPM and the Bylaws.</p>
`);
    const { candidates } = pairsOf(html);
    expect(candidates).toEqual([]);
  });

  it('AC6: identical two-form re-definitions add no pair and no finding', () => {
    const form = (who: string) =>
      `<h2>${who} FORM</h2><p>The units offered (the "Units") are described in the Memorandum.</p><p>The Units are issued when the subscription is accepted.</p>`;
    const g = analyzeHtml(doc(form('ENTITY') + form('INDIVIDUAL')));
    const findings = runDeterministic(g);
    expect(buildReferencePairs(g, findings).candidates).toEqual([]);
    expect(findings.filter((f) => f.issue_class === 'defined_term_issue')).toEqual([]);
  });

  it('skips a pointer that overlaps a rule finding', () => {
    const g = analyzeHtml(ONEX);
    const { candidates, sites } = buildReferencePairs(g, runDeterministic(g));
    const c = find(candidates, 'Section E')!;
    const site = sites.find((s) => s.id === c.id)!;
    const block = g.structure.blocks[site.blockIndex]!;
    const rule = {
      detector_kind: 'rule',
      anchor: { blockId: block.id, offsetStart: site.start, offsetEnd: site.start + 3 },
    } as unknown as Parameters<typeof buildReferencePairs>[1][number];
    expect(find(buildReferencePairs(g, [rule]).candidates, 'Section E')).toBeUndefined();
  });
});
