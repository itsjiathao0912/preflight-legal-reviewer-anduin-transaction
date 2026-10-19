import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OPTION_CONDITION_COVERAGE_ID,
  optionConditionCoverage,
  partialCoverage,
} from '../../src/detectors/option-condition-coverage';
import { analyzeHtml } from '../../src/engine';
import { FindingSchema } from '../../src/findings/schema';

const run = (html: string) => optionConditionCoverage.run(analyzeHtml(html));

const DEMO = readFileSync(
  new URL('../../../../fixtures/variance/hartwell-crane/fund-I.html', import.meta.url),
  'utf8',
);

const OPTIONS = [
  'Individual',
  'Joint tenants',
  'Trust',
  'IRA',
  'Corporation',
  'Partnership or LLC',
];
function doc(opts: {
  options?: string[];
  cue?: string;
  between?: number;
  condition?: string;
  otherSection?: boolean;
}): string {
  const options = (opts.options ?? OPTIONS).map((o) => `<p>☐ ${o}</p>`).join('');
  const filler = Array.from({ length: opts.between ?? 0 }, (_, i) => `<p>Note ${i + 1}.</p>`).join(
    '',
  );
  const cond =
    opts.condition ??
    'If the Investor is a trust, corporation or partnership, also complete Section 3.';
  return [
    '<p>Section 1. Subscription</p><p>The Investor subscribes.</p>',
    '<p>Section 2. Investor Information</p>',
    `<p>Investor type ${opts.cue ?? '(check one)'}:</p>`,
    options,
    filler,
    opts.otherSection ? '<p>Section 3. Entity Investors</p>' : '',
    `<p>${cond}</p>`,
    opts.otherSection ? '' : '<p>Section 3. Entity Investors</p>',
    '<p>The entity provides formation documents.</p><p>Section 4. Signature</p><p>Signature: ____</p>',
  ].join('');
}

describe('option-condition-coverage', () => {
  it('(a) demo doc: exactly 1 finding on "Partnership or LLC" naming LLC and Section 3', () => {
    const f = run(DEMO);
    expect(f).toHaveLength(1);
    const x = f[0]!;
    expect(FindingSchema.safeParse(x).success).toBe(true);
    expect(x.detector_id).toBe(OPTION_CONDITION_COVERAGE_ID);
    expect(x.issue_class).toBe('option_gap_overlap');
    expect(x.severity).toBe('high');
    expect(x.detail.facts.option).toBe('Partnership or LLC');
    expect(x.detail.facts.unnamed).toBe('LLC');
    expect(String(x.detail.facts.condition)).toContain('trust, corporation or partnership');
    expect(x.detail.facts.where).toBe('Section 2, Part B');
    const q = String(x.detail.facts.counsel_question);
    expect(q).toBe('Should LLC investors complete Section 3?');
    expect(x.detail.explanation).toContain('Partnership or LLC');
  });

  it('synthetic doc flags the same option', () => {
    const f = run(doc({}));
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.facts.unnamed).toBe('LLC');
  });

  it('(b) single-type options (Individual, IRA) are never flagged', () => {
    expect(partialCoverage('Individual', 'If the Investor is a trust or partnership')).toBeNull();
    expect(partialCoverage('IRA', 'If the Investor is a trust or partnership')).toBeNull();
    expect(run(doc({ options: ['Individual', 'Joint tenants', 'Trust', 'IRA'] }))).toEqual([]);
  });

  it('(c) a fully named option is not flagged', () => {
    expect(run(doc({ options: ['Individual', 'Corporation', 'Trust or Partnership'] }))).toEqual(
      [],
    );
  });

  it('plural folding: "LLCs" in the trigger names LLC', () => {
    expect(
      run(doc({ condition: 'If the Investor is a partnership or LLCs, also complete Section 3.' })),
    ).toEqual([]);
  });

  it('(d) a conditional 5 blocks after the group is not flagged', () => {
    expect(run(doc({ between: 5 }))).toEqual([]);
  });

  it('(e) a conditional in another section is not flagged', () => {
    expect(run(doc({ otherSection: true }))).toEqual([]);
  });

  it('(f) a non-exclusive group is not flagged', () => {
    expect(run(doc({ cue: '(check all that apply)' }))).toEqual([]);
  });

  it('(g) a negative conditional is not flagged', () => {
    expect(
      run(
        doc({
          condition: 'If the Investor is not a trust, corporation or partnership, skip Section 3.',
        }),
      ),
    ).toEqual([]);
  });

  it('(h) an account number in the option is masked', () => {
    const f = run(doc({ options: ['Individual', 'Corporation', 'Partnership or LLC 990000017'] }));
    expect(f).toHaveLength(1);
    for (const v of Object.values(f[0]!.detail.facts))
      if (typeof v === 'string') expect(v).not.toContain('990000017');
    expect(f[0]!.detail.explanation).not.toContain('990000017');
  });

  it('(i) output is deterministic over 2 runs', () => {
    expect(JSON.stringify(run(DEMO))).toBe(JSON.stringify(run(DEMO)));
  });
});
