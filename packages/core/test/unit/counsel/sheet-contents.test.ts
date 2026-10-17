import { describe, expect, it } from 'vitest';
import {
  buildCounselSheet,
  clampInterpretations,
  includeOnSheet,
  INTERPRETATION_MAX_CHARS,
  limits,
  maskQuote,
  templateInterpretations,
  templateQuestionText,
  CounselQuestionRequestSchema,
} from '../../../src/index';
import type { SheetFinding } from '../../../src/counsel/types';

const meta = { title: 'Fund II sub doc', firm: 'Firm X', fund: 'Fund II', version: 'v3' };
const f = (id: string, extra: Partial<SheetFinding> = {}): SheetFinding => ({
  id,
  severity: 'critical',
  issue_class: 'broken_cross_reference',
  location: 'Section 4',
  quote: `See Section 9 for ${id}.`,
  ...extra,
});

describe('sheet-contents', () => {
  it('should exclude already answered and awaiting counsel findings from the sheet', () => {
    const findings = ['n', 'aa', 'ac', 'pd', 'acc', 'dis', 'ans', 'unc', 'rc', 'rcAcc'].map((id) =>
      f(id),
    );
    const sheet = buildCounselSheet(
      meta,
      findings,
      {
        acc: { status: 'accepted' },
        dis: { status: 'dismissed', reasonCode: 'tool_false_alarm' },
        ans: { status: 'accepted', counselAnswer: 'A' },
        unc: { status: 'accepted', counselAnswer: 'unclear' },
        rcAcc: { status: 'counsel' },
      },
      {
        aa: 'already_answered',
        ac: 'awaiting_counsel',
        pd: 'previously_dismissed',
        rc: 'dismissed_reconfirm',
        rcAcc: 'dismissed_reconfirm',
      },
    );
    expect(sheet.meta).toEqual(meta);
    expect(sheet.questions.map((q) => q.findingKey)).toEqual(['n', 'acc', 'unc', 'rcAcc']);
    expect(sheet.questions.map((q) => q.number)).toEqual([1, 2, 3, 4]);
    expect(sheet.questions[0]!.link).toBe('#findings/n');
  });

  it('returns an unclear answer as New even with an excluded prior label', () => {
    expect(includeOnSheet({ status: 'open', counselAnswer: 'unclear' }, 'already_answered')).toBe(
      true,
    );
    expect(includeOnSheet({ status: 'open', counselAnswer: 'C' }, 'new')).toBe(false);
    expect(includeOnSheet({ status: 'open' }, 'dismissed_reconfirm')).toBe(false);
  });

  it('masks and clamps the quote', () => {
    const long = 'Wire to account 021000021 ' + 'x'.repeat(2000);
    const q = buildCounselSheet(meta, [f('m', { quote: long })], {}, {}).questions[0]!;
    expect(q.quote).not.toContain('021000021');
    expect(q.quote).toContain('#0021');
    expect(q.quote.length).toBeLessThanOrEqual(limits.quoteMaxChars);
    expect(maskQuote('short')).toBe('short');
  });

  it('uses edited drafts when given, clamped to Worker limits', () => {
    const drafts = { n: ['', 'a'.repeat(900), 'b', 'c', 'd', 'e', 'f', 'g'] };
    const q = buildCounselSheet(meta, [f('n')], {}, {}, { drafts }).questions[0]!;
    expect(q.interpretations).toHaveLength(6);
    expect(q.interpretations[0]!.length).toBeLessThanOrEqual(INTERPRETATION_MAX_CHARS);
    expect(clampInterpretations([' ', ''])).toHaveLength(1);
  });

  it('template draft is deterministic and accepted by the Worker question schema', () => {
    for (const cls of ['broken_cross_reference', 'ambiguity', 'unknown_class']) {
      const a = templateInterpretations(cls);
      expect(a).toEqual(templateInterpretations(cls));
      const parsed = CounselQuestionRequestSchema.safeParse({
        client_op_id: 'op_1234567890abcdef',
        finding_ref: 'f_1',
        fingerprint: 'a'.repeat(64),
        interpretations: a,
      });
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
    expect(templateQuestionText('ambiguity', 'Section 2')).toContain('Ambiguity at Section 2');
    expect(templateQuestionText('x', '')).toContain('the cited clause');
  });
});
