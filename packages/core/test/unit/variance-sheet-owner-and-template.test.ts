import { describe, expect, it } from 'vitest';
import {
  buildCounselSheet,
  CounselQuestionRequestSchema,
  INTERPRETATION_MAX_CHARS,
  templateInterpretations,
} from '../../src/index';
import {
  templateVersionDriftInterpretations,
  templateVersionDriftQuestion,
} from '../../src/counsel/template-draft';
import type { SheetFinding } from '../../src/counsel/types';

/**
 * AC-V12 / AC-V4 sheet path (core): the per-owner filter leaves the sheet unchanged when no owner
 * is passed; per-owner sheets carry `<findingId>@<owner>` keys for change findings and the plain
 * id for error findings; the deterministic `version_drift` draft has old text, new text and A/B/C,
 * masked, each interpretation at most 500 chars.
 */
const meta = {
  title: 'Fund III sub doc',
  firm: 'Hartwell & Crane LLP',
  fund: 'Fund III',
  version: null,
};
const err = (id: string): SheetFinding => ({
  id,
  severity: 'critical',
  issue_class: 'broken_cross_reference',
  location: 'Section 4',
  quote: `See Section 9 for ${id}.`,
});
const chg = (id: string, owners: SheetFinding['owners'], extra: Partial<SheetFinding> = {}) =>
  ({
    id,
    severity: 'medium',
    issue_class: 'version_drift',
    location: 'Section 2 Part A',
    quote: 'Singapore is also accepted as a domicile.',
    owners,
    change: {
      change_type: 'new',
      old_text: '',
      new_text: 'Singapore is also accepted as a domicile.',
    },
    ...extra,
  }) as SheetFinding;

describe('variance-sheet-owner-and-template', () => {
  const findings = [err('e1'), chg('c1', ['gp', 'counsel']), chg('c2', ['fund_admin'])];

  it('should leave the sheet unchanged when no owner is passed', () => {
    const legacy = buildCounselSheet(meta, [err('e1'), err('e2')], {}, {});
    expect(legacy.meta).toEqual(meta);
    expect(legacy.meta).not.toHaveProperty('owner');
    expect(legacy.questions.map((q) => q.findingKey)).toEqual(['e1', 'e2']);
    expect(legacy.questions[0]!.interpretations).toEqual(
      templateInterpretations('broken_cross_reference'),
    );
    const all = buildCounselSheet(meta, findings, {}, {});
    expect(all.questions.map((q) => q.findingKey)).toEqual(['e1', 'c1', 'c2']);
  });

  it('should filter per owner with composite keys for change findings only', () => {
    const counsel = buildCounselSheet(meta, findings, {}, {}, { owner: 'counsel' });
    expect(counsel.meta).toEqual({ ...meta, owner: 'counsel' });
    expect(counsel.questions.map((q) => q.findingKey)).toEqual(['e1', 'c1@counsel']);
    expect(counsel.questions.map((q) => q.link)).toEqual(['#findings/e1', '#findings/c1']);
    const gp = buildCounselSheet(meta, findings, {}, {}, { owner: 'gp' });
    expect(gp.questions.map((q) => q.findingKey)).toEqual(['c1@gp']);
    const fa = buildCounselSheet(meta, findings, {}, {}, { owner: 'fund_admin' });
    expect(fa.questions.map((q) => [q.number, q.findingKey])).toEqual([[1, 'c2@fund_admin']]);
  });

  it('should drop an owner question once that owner answered A/B/C (each answerable alone)', () => {
    const states = {
      c1: { status: 'counsel' as const, ownerAnswers: { gp: 'A' as const, counsel: null } },
    };
    expect(buildCounselSheet(meta, findings, states, {}, { owner: 'gp' }).questions).toHaveLength(
      0,
    );
    expect(
      buildCounselSheet(meta, findings, states, {}, { owner: 'counsel' }).questions.map(
        (q) => q.findingKey,
      ),
    ).toEqual(['e1', 'c1@counsel']);
  });

  it('should draft a masked version_drift question with old text, new text and A/B/C', () => {
    const acct = '990000017';
    const d = templateVersionDriftInterpretations({
      change_type: 'changed_logic',
      old_text: `The minimum is US$ 250,000 paid to account ${acct}.`,
      new_text: `The minimum is US$ 500,000 paid to account ${acct}.`,
    });
    expect(d).toHaveLength(3);
    expect(d[0]).toContain('500,000');
    expect(d[1]).toContain('250,000');
    expect(d.join(' ')).not.toContain(acct);
    expect(d.join(' ')).toContain('#0017');
    for (const x of d) expect(x.length).toBeLessThanOrEqual(INTERPRETATION_MAX_CHARS);
    const long = templateVersionDriftInterpretations({
      change_type: 'new',
      old_text: '',
      new_text: 'word '.repeat(400),
    });
    for (const x of long) expect(x.length).toBeLessThanOrEqual(INTERPRETATION_MAX_CHARS);
    const removed = templateVersionDriftInterpretations({
      change_type: 'changed_logic',
      old_text: 'Appendix C questionnaire.',
      new_text: '',
    });
    expect(removed[0]).toContain('Appendix C questionnaire.');
    expect(
      templateVersionDriftQuestion(
        { change_type: 'new', old_text: '', new_text: 'x' },
        'Section 7A',
      ),
    ).toBe('New text vs the baseline at Section 7A: which version should we digitize?');
  });

  it('uses the version_drift draft on the sheet and the result passes the Worker request schema', () => {
    const s = buildCounselSheet(meta, findings, {}, {}, { owner: 'gp' });
    const q = s.questions[0]!;
    expect(q.interpretations[0]).toContain('Singapore is also accepted');
    expect(
      CounselQuestionRequestSchema.shape.interpretations.safeParse(q.interpretations).success,
    ).toBe(true);
  });
});
