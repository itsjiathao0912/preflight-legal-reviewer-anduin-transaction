import { describe, expect, it } from 'vitest';
import { detectDocument, DETECT_RULES, NO_MATCH_REASON } from '../../src/package/index';
import { designFiles, docOf, factsOf, HARTWELL, load } from '../helpers/package-fixtures';

const REASON_RE =
  /^(?:Title says "[^"]+"|File name contains "[^"]+"|Opening text mentions "[^"]+")$/;
const RULE_PHRASES = new Set(DETECT_RULES.flatMap((r) => [...r.title, ...r.fileTokens, ...r.body]));

const ALL = [
  HARTWELL.sub,
  HARTWELL.lpa,
  HARTWELL.prior,
  ...['northgate-iii', 'lotus-bay-asia-ii', 'redwood-ridge-i'].flatMap(designFiles),
];

describe('package-detect (AC-I4)', () => {
  it.each(ALL)('should give type, role, confidence and a template reason for %s', async (rel) => {
    const d = docOf(factsOf(await load(rel)));
    expect(d.type).toMatch(/^(sub_agreement|lpa|ppm|tax_form|side_letter|other)$/);
    expect(d.role).toMatch(/^(to_digitize|reference|baseline)$/);
    expect(d.confidence).toMatch(/^(high|low)$/);
    if (d.reason !== NO_MATCH_REASON) {
      expect(d.reason).toMatch(REASON_RE);
      // the quoted phrase comes from the rule table, never from the document body
      expect(RULE_PHRASES.has(/"([^"]+)"/.exec(d.reason)![1]!)).toBe(true);
    }
  });

  it('gives other/low with the fixed reason when nothing matches', () => {
    expect(
      detectDocument({ name: 'x.pdf', titleLines: ['Hello'], headText: 'Plain words.' }),
    ).toEqual({
      type: 'other',
      role: 'reference',
      confidence: 'low',
      reason: NO_MATCH_REASON,
    });
  });

  it('a tie is never high and resolves to the earliest title line', () => {
    const d = detectDocument({
      name: 'doc.pdf',
      titleLines: ['Prospectus and Subscription Agreement'],
      headText: '',
    });
    expect(d.type).toBe('ppm');
    expect(d.confidence).toBe('low');
  });

  it('SEC cover boilerplate maps to ppm at low', () => {
    const d = detectDocument({
      name: 'filing.htm',
      titleLines: ['UNITED STATES', 'SECURITIES AND EXCHANGE COMMISSION'],
      headText: 'REGISTRATION STATEMENT UNDER THE SECURITIES ACT OF 1933',
    });
    expect(d).toEqual({
      type: 'ppm',
      role: 'reference',
      confidence: 'low',
      reason: 'Opening text mentions "registration statement"',
    });
  });

  it('high needs score >= 3 and margin >= 2; a file name alone stays low', () => {
    expect(detectDocument({ name: 'fund-lpa.pdf', titleLines: [], headText: '' }).confidence).toBe(
      'low',
    );
    expect(
      detectDocument({ name: 'sub.pdf', titleLines: ['SUBSCRIPTION AGREEMENT'], headText: '' })
        .confidence,
    ).toBe('high');
  });

  it('prose lines never carry title points', () => {
    const d = detectDocument({
      name: 'questionnaire.docx',
      titleLines: [
        'INVESTOR QUESTIONNAIRE',
        'The Administrator compares the answers with the Subscription Agreement and the documents.',
      ],
      headText: '',
    });
    expect(d.type).toBe('other');
  });
});
