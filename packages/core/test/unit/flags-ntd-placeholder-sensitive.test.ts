import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { FLAG_SENSITIVE_ID, sensitiveHits } from '../../src/detectors/flag-sensitive';
import { analyzed } from '../helpers/samples';

/** AC10 flags: drafting notes, placeholders, sensitive numbers (masked). Synthetic numbers only. */
const by = (n: number | string, id: string) =>
  analyzed(n).findings.filter((f) => f.detector_id === id);

// Synthetic, non-routable values (ABA prefix 99 is not a Fed routing prefix).
const ABA = '990000017';
const DDA = '000111222333';

describe('flags-ntd-placeholder-sensitive (AC10)', () => {
  it('should flag NTD drafting note in sample 5', () => {
    const f = by(5, 'flag-drafting-note');
    expect(f).toHaveLength(1);
    expect(f[0]!.issue_class).toBe('drafting_note');
    expect(f[0]!.severity).toBe('medium');
    expect(f[0]!.detail.facts.marker).toBe('NTD:');
    expect(f[0]!.quote).toContain('NTD: PG to confirm factual information');
    expect(f[0]!.pattern_key).toBe('flag-drafting-note:ntd');
  });

  it('should flag [insert investor name] as placeholder but not ____ blanks', () => {
    for (const n of [3, 6]) {
      const f = by(n, 'flag-placeholder');
      expect(f).toHaveLength(1);
      expect(f[0]!.detail.facts.placeholder).toBe('[insert investor name]');
      expect(f[0]!.pattern_key).toBe('flag-placeholder:insert');
    }
    const five = by(5, 'flag-placeholder').map((f) => f.detail.facts.shape);
    expect(five.sort()).toEqual(['insert', 'xx']);
    const g = analyzeHtml(
      '<p>Name of Subscriber: ____________</p><p>Signature: __________ Date: ______</p><p>☐ Yes [ ] No</p><p>Wire to account [xx] today.</p>',
    );
    const ph = runDeterministic(g).filter((f) => f.issue_class === 'placeholder');
    expect(ph).toHaveLength(1);
    expect(ph[0]!.detail.facts.placeholder).toBe('[xx]');
  });

  it('flags the six [●] placeholders on #2 and never the [***] redactions on #12', () => {
    expect(by(2, 'flag-placeholder').filter((f) => f.detail.facts.shape === 'bullet')).toHaveLength(
      6,
    );
    expect(by(12, 'flag-placeholder')).toHaveLength(0);
    expect(analyzed(12).findings.filter((f) => f.quote.includes('[***]'))).toHaveLength(0);
  });

  it('should flag ABA routing and DDA on sample 1 with masked quote and 3 facts (last4, cue, kind)', () => {
    const f = by(1, FLAG_SENSITIVE_ID);
    expect(f.map((x) => x.detail.facts.kind)).toEqual(['aba', 'dda']);
    for (const x of f) {
      expect(x.issue_class).toBe('sensitive_data');
      expect(x.severity).toBe('medium');
      expect(x.detail.facts.last4).toMatch(/^#\d{4}$/);
      expect(typeof x.detail.facts.cue).toBe('string');
      expect(Object.keys(x.detail.facts)).toEqual(expect.arrayContaining(['last4', 'cue', 'kind']));
      expect(x.quote).toMatch(/#\d{4}/);
      // no digit run longer than 4 survives in any field
      const text = JSON.stringify([x.quote, x.quote_snippet, x.detail]);
      expect(text).not.toMatch(/\d{5,}|\d{4}-\d{4}/);
    }
    expect(f[0]!.detail.facts.cue).toBe('ABA routing');
  });

  it('should not flag phone, fax, P.O. Box or ZIP digits that carry no account cue', () => {
    // #1: phone, fax, P.O. Box, ZIP+4 and suite numbers are never sensitive findings
    const one = by(1, FLAG_SENSITIVE_ID);
    expect(one).toHaveLength(2);
    for (const q of ['Fax', 'Phone', 'P.O. Box', 'Kansas City']) {
      expect(one.some((x) => x.quote.includes(q))).toBe(false);
    }
    // #7: phone numbers stay unflagged; only the wire line is flagged
    const seven = by(7, FLAG_SENSITIVE_ID);
    expect(seven).toHaveLength(1);
    expect(seven[0]!.quote).not.toContain('(844)');
    // synthetic negatives
    expect(
      sensitiveHits('Call 1-877-555-0100 or fax (617) 555-0199, P.O. Box 219000, ZIP 64121-9520.'),
    ).toEqual([]);
  });

  it('sample #7: ABA# and DDA# in one sentence become ONE finding listing both cues (no id collapse)', () => {
    const f = by(7, FLAG_SENSITIVE_ID)[0]!;
    expect(f.detail.facts.kind).toBe('aba, dda');
    expect(f.detail.facts.cue).toBe('ABA#, DDA#');
    expect(f.detail.facts.count).toBe(2);
    expect(String(f.detail.facts.last4).split(', ')).toHaveLength(2);
    expect(f.pattern_key).toBe('flag-sensitive:aba-dda');
  });

  it('synthetic cue forms: "ABA:", "Account Number:", "routing no." are flagged and masked', () => {
    const g = analyzeHtml(
      `<p>Bank: Example Bank ABA: ${ABA}</p><p>Account Number: ${DDA}</p><p>Use routing no. ${ABA} only.</p>`,
    );
    const f = runDeterministic(g).filter((x) => x.detector_id === FLAG_SENSITIVE_ID);
    expect(f.map((x) => x.detail.facts.kind)).toEqual(['aba', 'account', 'routing']);
    for (const x of f) {
      const json = JSON.stringify(x);
      expect(json).not.toContain(ABA);
      expect(json).not.toContain(DDA);
    }
  });
});
