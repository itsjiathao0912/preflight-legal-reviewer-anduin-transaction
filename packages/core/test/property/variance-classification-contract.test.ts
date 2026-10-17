import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CHANGE_CLASSES,
  loadVarianceRules,
  RULE_IDS,
  runVariance,
  type ClassifiedHunk,
  type VarianceInput,
  type VarianceResult,
} from '../../src/variance/index';
import {
  demoPair,
  doc,
  expectedSeeded,
  sampleVSide,
  seededPair,
  sideOfHtml,
  vside,
} from '../helpers/variance';

/**
 * AC-V2: every raw change has exactly one class, an old/new passage and a rule id (property over
 * the whole corpus, #5/#6 and random edits), plus the G2 / G3 named cases and the hunk-merge pin.
 */
const rules = loadVarianceRules();
const ruleClass = new Map(rules.config.rules.map((r) => [r.id, r.class] as const));

function checkContract(r: VarianceResult) {
  expect(r.summary.raw).toBe(r.rawChanges.length);
  expect(r.summary.cosmetic).toBe(
    r.rawChanges.filter((h) => h.class === 'changed_cosmetic').length,
  );
  expect(r.summary.shown).toBe(r.findings.length);
  expect(r.summary.new + r.summary.changed_logic).toBe(r.summary.shown);
  r.rawChanges.forEach((h, i) => {
    expect(h.index).toBe(i);
    expect(CHANGE_CLASSES).toContain(h.class);
    expect(RULE_IDS).toContain(h.ruleId);
    expect(ruleClass.get(h.ruleId)).toBe(h.class);
    // evidence: an old or a new passage (a move carries the unit titles)
    expect(h.oldText.length + h.newText.length).toBeGreaterThan(0);
    expect(h.unitKeyA ?? h.unitKeyB).toBeTruthy();
  });
}

const pairOf = (a: string, b: string): VarianceInput => ({
  baseline: sideOfHtml(a, 'A'),
  current: sideOfHtml(b, 'B'),
});
const COVER = ['Kestrel Point Income Fund II, L.P.', 'Dated as of March 3, 2024'];
const COVER_NEW = ['Kestrel Point Income Fund II, L.P.', 'Dated as of June 3, 2026'];
const one = (r: VarianceResult, pred: (h: ClassifiedHunk) => boolean) => {
  const hs = r.rawChanges.filter(pred);
  expect(hs).toHaveLength(1);
  return hs[0]!;
};

describe('variance-classification-contract', () => {
  it('should give every raw change exactly one class with old/new passage and rule id', () => {
    checkContract(runVariance(demoPair()));
    checkContract(
      runVariance({
        baseline: vside('hartwell-crane/fund-I.html', 'Fund I'),
        current: vside('hartwell-crane/fund-II.html', 'Fund II'),
      }),
    );
    for (const c of expectedSeeded()) checkContract(runVariance(seededPair(c.id)));
    checkContract(runVariance({ baseline: sampleVSide(5, '#5'), current: sampleVSide(6, '#6') }));
  });

  it('holds the contract under random word edits (property)', () => {
    const sentences = [
      'The Investor must deliver the signed form before the closing.',
      'Each holder receives a quarterly report from the administrator.',
      'The general partner keeps the register of the fund.',
    ];
    const base = doc(COVER, [
      ['1', 'Investor Information', sentences],
      ['2', 'Payment', ['Subscription monies are paid by wire transfer.']],
    ]);
    const word = fc.constantFrom(
      'shall',
      'not',
      'Fund',
      'trust',
      '15',
      'quarterly',
      'the',
      'US',
      'x',
    );
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat(2), fc.nat(9), word, fc.constantFrom('ins', 'del', 'rep')), {
          minLength: 1,
          maxLength: 4,
        }),
        (edits) => {
          const s = sentences.map((x) => x.split(' '));
          for (const [si, wi, w, op] of edits) {
            const ws = s[si]!;
            const at = wi % ws.length;
            if (op === 'ins') ws.splice(at, 0, w);
            else if (op === 'del' && ws.length > 2) ws.splice(at, 1);
            else ws[at] = w;
          }
          const b = doc(COVER, [
            ['1', 'Investor Information', s.map((x) => x.join(' '))],
            ['2', 'Payment', ['Subscription monies are paid by wire transfer.']],
          ]);
          const r = runVariance(pairOf(base, b));
          checkContract(r);
          // unknown means logic: no single random edit word is ever cosmetic here
          for (const h of r.rawChanges) expect(h.class).not.toBe('changed_cosmetic');
        },
      ),
      { numRuns: 30, seed: 20261017 },
    );
  });

  describe('G2 digit-guard named cases (this plan governs over DECISION D1 text)', () => {
    const gapA = (ref: string) =>
      doc(COVER, [
        ['1', 'Investor Information', ['The Investor completes this form.']],
        ['2', 'Beneficial Owners', ['Owners are listed here.']],
        ['3', 'Subscription', [ref]],
        ['5', 'Payment', ['Monies are paid by wire.']],
      ]);
    const gapB = (ref: string) =>
      doc(COVER, [
        ['1', 'Investor Information', ['The Investor completes this form.']],
        ['2', 'Beneficial Owners', ['Owners are listed here.']],
        ['3', 'Subscription', [ref]],
        ['4', 'Payment', ['Monies are paid by wire.']],
      ]);

    it('renumber-mapped-target = cosmetic', () => {
      const r = runVariance(
        pairOf(
          gapA('See Section 5 for the payment terms.'),
          gapB('See Section 4 for the payment terms.'),
        ),
      );
      const ref = one(r, (h) => h.unitKeyB === 'body:1/s3');
      expect([ref.class, ref.ruleId]).toEqual(['changed_cosmetic', 'VAR-COS-RENUMBER']);
      expect(r.summary.shown).toBe(0);
    });
    it('renumber-target-did-not-move = logic', () => {
      const r = runVariance(
        pairOf(gapB('See Section 2 for the owners.'), gapB('See Section 3 for the owners.')),
      );
      const ref = one(r, () => true);
      expect([ref.class, ref.ruleId]).toEqual(['changed_logic', 'VAR-LOGIC-GUARD-DIGIT']);
    });
    it('renumber hunk that also changes a percent value = logic', () => {
      const r = runVariance(
        pairOf(gapA('See Section 5 2% fee terms.'), gapB('See Section 4 3% fee terms.')),
      );
      const h = one(r, (x) => x.unitKeyB === 'body:1/s3');
      expect(h.oldTokens).toEqual(['5', '2']);
      expect([h.class, h.ruleId]).toEqual(['changed_logic', 'VAR-LOGIC-GUARD-DIGIT']);
    });
    it('cover-date = cosmetic; date-in-operative-text = logic', () => {
      const body = (d: string) =>
        [['1', 'Subscription', [`Forms received after ${d} wait.`]]] as Array<
          [string, string, string[]]
        >;
      const cover = runVariance(
        pairOf(doc(COVER, body('March 3, 2024')), doc(COVER_NEW, body('March 3, 2024'))),
      );
      expect(cover.rawChanges.map((h) => [h.class, h.ruleId])).toEqual([
        ['changed_cosmetic', 'VAR-COS-DATE'],
        ['changed_cosmetic', 'VAR-COS-DATE'],
      ]);
      const operative = runVariance(
        pairOf(doc(COVER, body('March 3, 2024')), doc(COVER, body('June 3, 2026'))),
      );
      expect(operative.rawChanges.map((h) => h.class)).toEqual(['changed_logic', 'changed_logic']);
      expect(operative.rawChanges.map((h) => h.ruleId)).toEqual([
        'VAR-LOGIC-DEFAULT',
        'VAR-LOGIC-GUARD-DIGIT',
      ]);
    });
    it('Units to Shares plus an added number = logic (the guard wins over the rename)', () => {
      const s = (t: string, n: string) => [
        `Each holder of the ${t} receives a report.`,
        `A transfer of the ${t} needs consent.`,
        `Payments on the ${t} are made in dollars.`,
        `The ${n}${t} are held by the custodian.`,
      ];
      const r = runVariance(
        pairOf(
          doc(COVER, [['1', 'Subscription', s('Units', '')]]),
          doc(COVER, [['1', 'Subscription', s('Shares', '100 ')]]),
        ),
      );
      expect(r.rawChanges.filter((h) => h.ruleId === 'VAR-COS-RENAME')).toHaveLength(3);
      const n = one(r, (h) => h.newText.includes('100'));
      expect([n.class, n.ruleId]).toEqual(['changed_logic', 'VAR-LOGIC-GUARD-DIGIT']);
    });
    it('a format change on a guard-bearing token is logic by design', () => {
      const r = runVariance(
        pairOf(
          doc(COVER, [
            ['1', 'Subscription', ['The partner MAY accept less.', 'The fee is $1,000 per year.']],
          ]),
          doc(COVER, [
            ['1', 'Subscription', ['The partner may accept less.', 'The fee is $1000 per year.']],
          ]),
        ),
      );
      expect(r.rawChanges.map((h) => [h.class, h.ruleId])).toEqual([
        ['changed_logic', 'VAR-LOGIC-GUARD-MODAL'],
        ['changed_logic', 'VAR-LOGIC-GUARD-DIGIT'],
      ]);
      // the same normalization on a non-guard token is cosmetic
      const ok = runVariance(
        pairOf(
          doc(COVER, [['1', 'Subscription', ['Send the form by e-mail today.']]]),
          doc(COVER, [['1', 'Subscription', ['Send the form by email today.']]]),
        ),
      );
      expect(ok.rawChanges.map((h) => h.ruleId)).toEqual(['VAR-COS-FORMAT']);
    });
  });

  describe('G3 cluster-class named cases', () => {
    const longA =
      'The administrator may also request a certified copy of the formation documents of the Investor.';
    const longB =
      'The custodian keeps every signed form in a secure archive for at least seven full years.';
    const base = ['The Investor completes this form.', 'Owners are listed here within 10 days.'];
    const run = (b: string[], extra: Array<[string, string, string[]]> = []) =>
      runVariance(
        pairOf(
          doc(COVER, [['1', 'Investor Information', base]]),
          doc(COVER, [['1', 'Investor Information', b], ...extra]),
        ),
      );
    it('all-insertions cluster = new', () => {
      const r = run([longA, base[0]!, base[1]!, longB]);
      expect(r.rawChanges.map((h) => h.ruleId)).toEqual(['VAR-NEW-INSERTION', 'VAR-NEW-INSERTION']);
      expect(r.summary).toMatchObject({ shown: 1, new: 1, changed_logic: 0 });
      expect(r.meta[r.findings[0]!.id]!.rule_id).toBe('VAR-NEW-INSERTION');
    });
    it('mixed cluster = changed_logic', () => {
      const r = run([longA, base[0]!, 'Owners are listed here within 15 days.']);
      expect(r.summary).toMatchObject({ shown: 1, new: 0, changed_logic: 1 });
      expect(r.meta[r.findings[0]!.id]!.rule_id).toBe('VAR-LOGIC-GUARD-DIGIT');
    });
    it('added unit = new', () => {
      const r = run(base, [['2', 'Source of Funds Verification', []]]);
      expect(r.summary).toMatchObject({ raw: 1, shown: 1, new: 1 });
      expect(r.meta[r.findings[0]!.id]!.rule_id).toBe('VAR-NEW-UNIT');
    });
    it('7-word insertion (the 4.2 shape) = changed_logic', () => {
      const r = runVariance(
        pairOf(
          doc(COVER, [
            [
              '1',
              'Beneficial Owners',
              ['Each Investor that is an entity shall provide the names of its beneficial owners.'],
            ],
          ]),
          doc(COVER, [
            [
              '1',
              'Beneficial Owners',
              [
                'Each Investor that is an entity formed or organized outside the United States shall provide the names of its beneficial owners.',
              ],
            ],
          ]),
        ),
      );
      const h = one(r, () => true);
      expect(h.newTokens).toHaveLength(7);
      expect(r.summary).toMatchObject({ shown: 1, new: 0, changed_logic: 1 });
    });
  });

  describe('hunk merge granularity is pinned to the config (edge case 1)', () => {
    const raw = (a: string, b: string, r = rules) =>
      runVariance({
        baseline: sideOfHtml(doc(COVER, [['1', 'Payment', [a]]]), 'A'),
        current: sideOfHtml(doc(COVER, [['1', 'Payment', [b]]]), 'B'),
        rules: r,
      }).summary.raw;
    it('merges edits 0 and 1 tokens apart and splits edits 2 tokens apart (merge_gap_tokens 1)', () => {
      expect(rules.config.hunk.merge_gap_tokens).toBe(1);
      expect(raw('aa bb cc dd', 'aa XX! cc dd')).toBe(1); // 0 apart: "XX" + "!" adjacent
      expect(raw('aa bb cc dd', 'aa XX YY dd')).toBe(1); // 1 apart: one space between edits
      expect(raw('aa bb, cc dd', 'aa XX, YY dd')).toBe(2); // 2 apart: ", " between edits
    });
    it('splits edits 1 token apart when the config pins merge_gap_tokens 0', () => {
      const cfg = JSON.parse(JSON.stringify(rules.config)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      cfg.hunk.merge_gap_tokens = 0;
      const r0 = loadVarianceRules(cfg);
      expect(raw('aa bb cc dd', 'aa XX YY dd', r0)).toBe(2);
      expect(raw('aa bb cc dd', 'aa XX! cc dd', r0)).toBe(1);
    });
  });

  it('step 0: a cross-firm or unknown-firm pair gives a notice and no output', () => {
    const { baseline, current } = demoPair();
    for (const firm of [null, 'firm-x']) {
      const r = runVariance({ baseline: { ...baseline, firmId: firm }, current });
      expect(r.notice).toBe('cross_firm');
      expect(r.findings).toEqual([]);
      expect(r.summary.raw).toBe(0);
    }
  });
});
