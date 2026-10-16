/**
 * fixtures:build (Phase 02, C1/C2/C4): writes
 *  - fixtures/html-seeded/<detector>/<case>.html + expected.json (one clean control and >= 1
 *    seeded defect per Phase 02 detector; expectations are AUTHORED here, never read back from
 *    the engine)
 *  - fixtures/memory/{fund-I,fund-II,fund-Y}.html, fund-expectations.json, fund-I-decisions.json,
 *    fund-I-answers.json (fingerprints and labels computed from real engine output)
 *  - fixtures/memory/demo-seed-spec.json (DemoSeedSpec v1 from real findings on samples #3-#6)
 * Output is deterministic and prettier-clean (HTML lines <= 100 chars, JSON 2-space). Synthetic,
 * non-routable account numbers only; no raw number is ever written (quotes come out masked).
 * `fixtures:check` (check.ts) rebuilds in memory and compares with the committed files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeHtml,
  DemoSeedSpecSchema,
  fingerprintFor,
  isBlocking,
  resolveLabel,
  runDeterministic,
  type ActiveDecision,
  type DemoSeedSpec,
  type Finding,
  type MemoryLabel,
} from '../../../packages/core/src/index';
import { DEMO_FIRM, ROOT, sampleFindings } from './find-shared-passages';

export const SEEDED_DIR = 'fixtures/html-seeded';
export const MEMORY_DIR = 'fixtures/memory';
const MAX_LINE = 100;

// ---------------------------------------------------------------- HTML helpers
const p = (t: string) => `<p>${t}</p>`;
const sec = (n: number, title: string) => `<p><b>${n}. ${title}</b></p>`;
const part = (letter: string, title: string) => `<p><b>Part ${letter} – ${title}</b></p>`;
const sup = (m: string) => `<sup>${m}</sup>`;

export function html(lines: string[]): string {
  const body = lines.map((l) => `    ${l}`);
  for (const l of body)
    if (l.length > MAX_LINE) throw new Error(`fixture line over ${MAX_LINE} chars: ${l}`);
  return `<html>\n  <body>\n${body.join('\n')}\n  </body>\n</html>\n`;
}

/**
 * JSON in the exact shape prettier prints (printWidth 100): objects expanded, arrays of primitives
 * inline when they fit on the line, otherwise one item per line.
 */
function pjson(v: unknown, indent: number, prefix: number): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const pad = ' '.repeat(indent + 2);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object')) {
      const inline = `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
      if (prefix + inline.length + 1 <= MAX_LINE) return inline;
    }
    const items = v.map((x) => pad + pjson(x, indent + 2, pad.length));
    return `[\n${items.join(',\n')}\n${' '.repeat(indent)}]`;
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return '{}';
  const items = entries.map(([k, x]) => {
    const key = `${pad}${JSON.stringify(k)}: `;
    return key + pjson(x, indent + 2, key.length);
  });
  return `{\n${items.join(',\n')}\n${' '.repeat(indent)}}`;
}

export const json = (v: unknown) => `${pjson(v, 0, 0)}\n`;

// Synthetic, non-routable values (ABA prefix 99 is not a Federal Reserve routing prefix).
const SYN_ABA = '990000017';
const SYN_DDA = '000111222333';

// ---------------------------------------------------------------- seeded cases
export interface Expect {
  detector_id: string;
  issue_class: string;
  count: number;
}
export interface SeededCase {
  file: string;
  kind: 'clean' | 'defect';
  note: string;
  lines: string[];
  expect: Expect[];
}
export interface SeededClass {
  detector: string;
  issue_class: string;
  cases: SeededCase[];
}

const e = (detector_id: string, issue_class: string, count = 1): Expect => ({
  detector_id,
  issue_class,
  count,
});

const signature = (n: number) => [sec(n, 'SIGNATURE'), p('Signature of Subscriber: ____________')];

const INVESTOR_TYPES_LINE =
  '☐ Individual ☐ Joint tenants ☐ Trust ☐ Corporation ☐ Partnership or LLC ☐ Other entity';

export const SEEDED: SeededClass[] = [
  {
    detector: 'broken-conditional',
    issue_class: 'broken_conditional',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'every conditional target exists',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('If the Subscriber is a custodial account, complete Section 2.'),
          sec(2, 'CUSTODIAN INFORMATION'),
          part('A', 'Custodian Name'),
          p('Name of Custodian: ____________'),
          part('B', 'Custodian Address'),
          p('If the account is held at a bank, complete Part B of Section 2.'),
          ...signature(3),
        ],
        expect: [],
      },
      {
        file: 'missing-section.html',
        kind: 'defect',
        note: 'the instruction points to Section 7; the form has Sections 1 to 3',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('If the Subscriber is a custodial account, complete Section 7.'),
          sec(2, 'CUSTODIAN INFORMATION'),
          p('Name of Custodian: ____________'),
          ...signature(3),
        ],
        expect: [e('broken-conditional', 'broken_conditional')],
      },
      {
        file: 'missing-part.html',
        kind: 'defect',
        note: 'Part D of Section 2 is cited; Section 2 has Parts A and B only',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('If the account is held at a bank, complete Part D of Section 2.'),
          sec(2, 'CUSTODIAN INFORMATION'),
          part('A', 'Custodian Name'),
          p('Name of Custodian: ____________'),
          part('B', 'Custodian Address'),
          p('Address of Custodian: ____________'),
          ...signature(3),
        ],
        expect: [e('broken-conditional', 'broken_conditional')],
      },
    ],
  },
  {
    detector: 'unreachable-flow',
    issue_class: 'unreachable_or_circular_flow',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'a conditional forward jump; every section stays reachable',
        lines: [
          sec(1, 'DISTRIBUTIONS'),
          p('If you elect cash distributions, proceed to Section 3.'),
          sec(2, 'REINVESTMENT'),
          p('Reinvestment account: ____________'),
          sec(3, 'PAYMENT'),
          p('Payment method: ____________'),
          ...signature(4),
        ],
        expect: [],
      },
      {
        file: 'circular.html',
        kind: 'defect',
        note: 'Section 2 jumps to Section 4 and Section 4 jumps back to Section 2',
        lines: [
          sec(1, 'INVESTOR'),
          p('Name of Subscriber: ____________'),
          sec(2, 'ELIGIBILITY'),
          p('If you checked Yes, proceed to Section 4.'),
          sec(3, 'PAYMENT'),
          p('Payment method: ____________'),
          sec(4, 'CONFIRMATION'),
          p('If you have not confirmed eligibility, go to Section 2.'),
          ...signature(5),
        ],
        expect: [e('unreachable-flow', 'unreachable_or_circular_flow')],
      },
      {
        file: 'unreachable.html',
        kind: 'defect',
        note: 'every subscriber is sent past Sections 2 and 3, which nothing else routes to',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('For all subscribers, proceed to Section 4.'),
          sec(2, 'ENTITY DETAILS'),
          p('Formation date: ____________'),
          sec(3, 'BENEFICIAL OWNERS'),
          p('Owner name: ____________'),
          sec(4, 'PAYMENT'),
          p('Payment method: ____________'),
          ...signature(5),
        ],
        expect: [e('unreachable-flow', 'unreachable_or_circular_flow')],
      },
    ],
  },
  {
    detector: 'option-gap-overlap',
    issue_class: 'option_gap_overlap',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'contiguous ranges and an exclusive group without "all of the above"',
        lines: [
          sec(1, 'FINANCIAL INFORMATION'),
          p('Annual income (check one):'),
          p('☐ Less than $100,000 ☐ $100,000 to $250,000 ☐ Over $250,000'),
          p('Distribution method (check only one):'),
          p('☐ Cash ☐ Reinvest'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'gap.html',
        kind: 'defect',
        note: 'no box for $100,001 to $149,999',
        lines: [
          sec(1, 'FINANCIAL INFORMATION'),
          p('Annual income (check one):'),
          p('☐ $0 to $100,000 ☐ $150,000 to $250,000 ☐ Over $250,000'),
          ...signature(2),
        ],
        expect: [e('option-gap-overlap', 'option_gap_overlap')],
      },
      {
        file: 'overlap.html',
        kind: 'defect',
        note: '$50,000 to $100,000 fits two boxes',
        lines: [
          sec(1, 'FINANCIAL INFORMATION'),
          p('Annual income (check one):'),
          p('☐ $0 to $100,000 ☐ $50,000 to $250,000 ☐ Over $250,000'),
          ...signature(2),
        ],
        expect: [e('option-gap-overlap', 'option_gap_overlap')],
      },
      {
        file: 'all-of-above.html',
        kind: 'defect',
        note: '"check only one" group offering "All of the above"',
        lines: [
          sec(1, 'DISTRIBUTIONS'),
          p('Distribution method (check only one):'),
          p('☐ Cash ☐ Reinvest ☐ All of the above'),
          ...signature(2),
        ],
        expect: [e('option-gap-overlap', 'option_gap_overlap')],
      },
    ],
  },
  {
    detector: 'defined-term-issues',
    issue_class: 'defined_term_issue',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'one definition, used after it, written as defined',
        lines: [
          sec(1, 'THE OFFERING'),
          p('This booklet covers shares of Example Growth Fund LP (the “Fund”).'),
          p('The Fund may reject any subscription in whole or in part.'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'duplicate.html',
        kind: 'defect',
        note: '"Fund" defined for two different entities in one scope',
        lines: [
          sec(1, 'THE OFFERING'),
          p('This booklet covers shares of Example Growth Fund LP (the “Fund”).'),
          sec(2, 'THE MANAGER'),
          p('The manager advises Example Income Trust (the “Fund”) as well.'),
          p('The Fund may reject any subscription in whole or in part.'),
          ...signature(3),
        ],
        expect: [e('defined-term-issues', 'defined_term_issue')],
      },
      {
        file: 'used-before-defined.html',
        kind: 'defect',
        note: '"Manager" is used in Section 1 and defined in Section 2',
        lines: [
          sec(1, 'ACCEPTANCE'),
          p('The Manager may accept or reject this subscription.'),
          sec(2, 'THE MANAGER'),
          p('Example Advisers LLC (the “Manager”) manages the portfolio.'),
          ...signature(3),
        ],
        expect: [e('defined-term-issues', 'defined_term_issue')],
      },
      {
        file: 'unused.html',
        kind: 'defect',
        note: '"Escrow Agent" is defined and never used',
        lines: [
          sec(1, 'PAYMENT'),
          p('Example Bank N.A. (the “Escrow Agent”) holds subscription payments.'),
          p('Payment method: ____________'),
          ...signature(2),
        ],
        expect: [e('defined-term-issues', 'defined_term_issue')],
      },
      {
        file: 'capitalization.html',
        kind: 'defect',
        note: '"Investor Questionnaire" also written "Investor questionnaire"',
        lines: [
          sec(1, 'DOCUMENTS'),
          p('Attach the questionnaire in Appendix B (the “Investor Questionnaire”).'),
          p('Return the Investor Questionnaire with this booklet.'),
          p('The Investor questionnaire must be signed by each owner.'),
          ...signature(2),
        ],
        expect: [e('defined-term-issues', 'defined_term_issue')],
      },
    ],
  },
  {
    detector: 'footnote-requirement',
    issue_class: 'inconsistent_footnote_requirement',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'footnote 1 on every sibling option',
        lines: [
          sec(1, 'PAYMENT'),
          p('Payment method (check one):'),
          p(`☐ Wire${sup('1')} ☐ Check${sup('1')} ☐ ACH${sup('1')}`),
          p('1 Funds must clear before the closing date.'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'one-sibling.html',
        kind: 'defect',
        note: 'footnote 1 on Wire and ACH, missing on Check',
        lines: [
          sec(1, 'PAYMENT'),
          p('Payment method (check one):'),
          p(`☐ Wire${sup('1')} ☐ Check ☐ ACH${sup('1')}`),
          p('1 Funds must clear before the closing date.'),
          ...signature(2),
        ],
        expect: [e('footnote-requirement', 'inconsistent_footnote_requirement')],
      },
    ],
  },
  {
    detector: 'flag-drafting-note',
    issue_class: 'drafting_note',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'notes to the reader are not drafting notes',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('Note: please read the offering memorandum before signing.'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'ntd-and-note.html',
        kind: 'defect',
        note: 'an NTD and a "Drafting note" left in the text',
        lines: [
          sec(1, 'INSTRUCTIONS'),
          p('NTD: fund counsel to confirm the closing date.'),
          p('Drafting note: update the minimum investment amount.'),
          ...signature(2),
        ],
        expect: [e('flag-drafting-note', 'drafting_note', 2)],
      },
    ],
  },
  {
    detector: 'flag-placeholder',
    issue_class: 'placeholder',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'fill-in blanks, [ ] boxes and [***] redactions are not placeholders',
        lines: [
          sec(1, 'INVESTOR'),
          p('Name of Subscriber: ____________'),
          p('Are you a U.S. person? [ ] Yes [ ] No'),
          p('Bank Name: [***]'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'placeholders.html',
        kind: 'defect',
        note: '[xx], [insert …] and [●] in three sentences',
        lines: [
          sec(1, 'WIRE INSTRUCTIONS'),
          p('Account Name: Example Fund [xx] Subscriptions'),
          p('For further credit to: Example Fund / [insert investor name]'),
          p('Class of Shares: Class A Shares - Series [●]'),
          ...signature(2),
        ],
        expect: [e('flag-placeholder', 'placeholder', 3)],
      },
    ],
  },
  {
    detector: 'flag-sensitive',
    issue_class: 'sensitive_data',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'phone, fax, P.O. Box and ZIP+4 digits carry no account cue',
        lines: [
          sec(1, 'CONTACT'),
          p('Phone: (555) 010-0199 Fax: (555) 010-0198'),
          p('P.O. Box 219000, Kansas City, MO 64121-9520'),
          ...signature(2),
        ],
        expect: [],
      },
      {
        file: 'aba-dda.html',
        kind: 'defect',
        note: 'ABA and DDA in two lines plus ABA# and DDA# in one sentence (one finding)',
        lines: [
          sec(1, 'WIRE INSTRUCTIONS'),
          p(`ABA: ${SYN_ABA}`),
          p(`DDA: ${SYN_DDA}`),
          p(`Wires may be sent to: FFC: Investor Name ABA#: ${SYN_ABA} DDA#: ${SYN_DDA}`),
          ...signature(2),
        ],
        expect: [e('flag-sensitive', 'sensitive_data', 3)],
      },
    ],
  },
  {
    detector: 'investor-path-dead-end',
    issue_class: 'investor_path_dead_end',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'every investor type reaches the signature section',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(INVESTOR_TYPES_LINE),
          p('If the Subscriber is a trust, complete Section 2.'),
          sec(2, 'TRUST INFORMATION'),
          p('Name of trustee: ____________'),
          ...signature(3),
        ],
        expect: [],
      },
      {
        file: 'uncertain.html',
        kind: 'clean',
        note: 'no signature section: the path is uncertain and never asserted',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(INVESTOR_TYPES_LINE),
          p('If the Subscriber is a trust, skip Section 2.'),
          sec(2, 'BENEFICIAL OWNERS'),
          p('Owner name: ____________'),
          sec(3, 'PAYMENT'),
          p('Payment method: ____________'),
        ],
        expect: [],
      },
      {
        file: 'skips-signature.html',
        kind: 'defect',
        note: 'trusts are told to skip Section 3, the signature section',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(INVESTOR_TYPES_LINE),
          p('If the Subscriber is a trust, skip Section 3.'),
          sec(2, 'TRUST INFORMATION'),
          p('Name of trustee: ____________'),
          ...signature(3),
        ],
        expect: [e('investor-path-dead-end', 'investor_path_dead_end')],
      },
    ],
  },
  {
    detector: 'investor-path-missing-item',
    issue_class: 'investor_path_missing_item',
    cases: [
      {
        file: 'clean.html',
        kind: 'clean',
        note: 'entity peers all carry footnote 2; individuals do not need it',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(`☐ Individual ☐ Joint tenants ☐ Trust${sup('2')}`),
          p(`☐ Corporation${sup('2')} ☐ Partnership or LLC${sup('2')}`),
          p('2 Attach entity formation documents.'),
          sec(2, 'TRUST INFORMATION'),
          part('A', 'Trustee'),
          p('If the Subscriber is a trust, it must also complete Part B of Section 2.'),
          part('B', 'Trust Documents'),
          p('Trust agreement date: ____________'),
          ...signature(3),
        ],
        expect: [],
      },
      {
        file: 'part-c.html',
        kind: 'defect',
        note: 'trusts must also complete Part C of Section 2, which does not exist',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(INVESTOR_TYPES_LINE),
          sec(2, 'TRUST INFORMATION'),
          part('A', 'Trustee'),
          p('If the Subscriber is a trust, it must also complete Part C of Section 2.'),
          part('B', 'Trust Documents'),
          p('Trust agreement date: ____________'),
          ...signature(3),
        ],
        expect: [
          e('investor-path-missing-item', 'investor_path_missing_item'),
          e('broken-conditional', 'broken_conditional'),
        ],
      },
      {
        file: 'peer-item.html',
        kind: 'defect',
        note: 'PATH-04: Trust, Corporation and Other entity carry footnote 2; Partnership or LLC does not',
        lines: [
          sec(1, 'TYPE OF SUBSCRIBER'),
          p('Subscriber type (check one):'),
          p(`☐ Individual ☐ Joint tenants ☐ Trust${sup('2')}`),
          p(`☐ Corporation${sup('2')} ☐ Partnership or LLC ☐ Other entity${sup('2')}`),
          p('2 Attach entity formation documents.'),
          sec(2, 'ENTITY INFORMATION'),
          p('Formation date: ____________'),
          ...signature(3),
        ],
        expect: [e('investor-path-missing-item', 'investor_path_missing_item')],
      },
    ],
  },
];

// ---------------------------------------------------------------- memory fixtures (fund I / II / Y)
export const FUND_FIRM = 'firm-x';
export const OTHER_FIRM = 'firm-y';

interface Passage {
  key: string;
  line: string;
  category: 'previously_dismissed' | 'already_answered' | 'new' | 'edited';
}

const P_PLACEHOLDER_INSERT = 'Payable to: the Fund Subscriptions Account / [insert investor name]';
const P_NTD = 'NTD: confirm the wire cut-off time with the administrator.';
const P_PLACEHOLDER_XX = 'Account Name: the Fund [xx] Subscriptions';
const P_BROKEN = 'If the Subscriber is a custodial account, complete Section 7.';
const P_OVERLAP = '☐ $0 to $100,000 ☐ $50,000 to $250,000 ☐ Over $250,000';
const P_EDIT_I = 'If the Subscriber is an IRA, complete Section 4.';
const P_EDIT_II = 'If the Subscriber is an IRA, complete Section 5.';
const P_NEW_BULLET = 'Class of Shares: Class A Shares - Series [●]';
const P_NEW_NOTE = 'Drafting note: update the minimum investment amount.';

function fundLines(name: string, version: 'I' | 'II'): string[] {
  return [
    p(`<b>${name}</b>`),
    sec(1, 'INVESTOR INFORMATION'),
    p('Name of Subscriber: ____________'),
    p(P_PLACEHOLDER_INSERT),
    p(P_NTD),
    p(P_PLACEHOLDER_XX),
    ...(version === 'II' ? [p(P_NEW_BULLET)] : []),
    sec(2, 'ACCOUNT TYPE'),
    p(P_BROKEN),
    p('Annual income (check one):'),
    p(P_OVERLAP),
    p(version === 'I' ? P_EDIT_I : P_EDIT_II),
    ...(version === 'II' ? [p(P_NEW_NOTE)] : []),
    ...signature(3),
  ];
}

const FUND_II_PASSAGES: Passage[] = [
  { key: 'p1-placeholder-insert', line: P_PLACEHOLDER_INSERT, category: 'previously_dismissed' },
  { key: 'p2-drafting-note', line: P_NTD, category: 'previously_dismissed' },
  { key: 'p3-placeholder-xx', line: P_PLACEHOLDER_XX, category: 'previously_dismissed' },
  { key: 'p4-broken-conditional', line: P_BROKEN, category: 'already_answered' },
  { key: 'p5-option-overlap', line: P_OVERLAP, category: 'already_answered' },
  { key: 'p6-edited-section-ref', line: P_EDIT_II, category: 'edited' },
  { key: 'n1-new-placeholder', line: P_NEW_BULLET, category: 'new' },
  { key: 'n2-new-drafting-note', line: P_NEW_NOTE, category: 'new' },
];

const FUNDS = {
  'fund-I': { file: 'fund-I.html', firm_id: FUND_FIRM, fund_name: 'Demo Fund I', version: 'I' },
  'fund-II': { file: 'fund-II.html', firm_id: FUND_FIRM, fund_name: 'Demo Fund II', version: 'II' },
  'fund-Y': { file: 'fund-Y.html', firm_id: OTHER_FIRM, fund_name: 'Demo Fund Y', version: 'II' },
} as const;

const plain = (line: string) => line.replace(/<[^>]+>/g, '');

function findingFor(findings: Finding[], line: string, where: string): Finding {
  const text = plain(line);
  const hit = findings.filter((f) => text.includes(f.quote) || f.quote.includes(text));
  if (hit.length !== 1)
    throw new Error(`${where}: expected exactly one finding for "${text}", got ${hit.length}`);
  return hit[0]!;
}

const DECIDED_AT = 1791763200000; // 2026-10-17T00:00:00Z, fixed for determinism
const ANALYST = 'Avery (simulated analyst)';

interface FundDecision {
  id: string;
  law_firm_id: string;
  fund: string;
  issue_class: string;
  pattern_key: string | null;
  quote: string;
  quote_hash: string;
  fingerprint: string;
  decision: 'dismissed' | 'answered';
  reason_code?: string;
  note?: string;
  counsel_option?: 'A' | 'B' | 'C';
  counsel_note?: string;
  decided_by_name: string;
  decided_at: number;
}

export function buildMemory(): Map<string, string> {
  const out = new Map<string, string>();
  const htmls = new Map<string, string>();
  for (const [id, f] of Object.entries(FUNDS)) {
    const doc = html(fundLines(f.fund_name, f.version));
    htmls.set(id, doc);
    out.set(`${MEMORY_DIR}/${f.file}`, doc);
  }
  const findings = (id: keyof typeof FUNDS) => runDeterministic(analyzeHtml(htmls.get(id)!));
  const fI = findings('fund-I');
  const fII = findings('fund-II');
  const fY = findings('fund-Y');
  if (fI.length !== 6) throw new Error(`fund I: expected 6 findings, got ${fI.length}`);
  if (fII.length !== 8) throw new Error(`fund II: expected 8 findings, got ${fII.length}`);
  if (fY.length !== 8) throw new Error(`fund Y: expected 8 findings, got ${fY.length}`);

  const decision = (
    i: number,
    line: string,
    extra: Pick<FundDecision, 'decision'> & Partial<FundDecision>,
  ): FundDecision => {
    const f = findingFor(fI, line, 'fund I');
    return {
      id: `fi-d${i}`,
      law_firm_id: FUND_FIRM,
      fund: 'fund-I',
      issue_class: f.issue_class,
      pattern_key: f.pattern_key ?? null,
      quote: f.quote,
      quote_hash: f.quote_hash,
      fingerprint: fingerprintFor(f, FUND_FIRM)!,
      decided_by_name: ANALYST,
      decided_at: DECIDED_AT + i * 60_000,
      ...extra,
    };
  };
  const decisions: FundDecision[] = [
    decision(1, P_PLACEHOLDER_INSERT, {
      decision: 'dismissed',
      reason_code: 'firm_standard_wording',
      note: 'Firm X leaves the investor name for the administrator to fill in.',
    }),
    decision(2, P_NTD, { decision: 'dismissed', reason_code: 'no_form_impact' }),
    decision(3, P_PLACEHOLDER_XX, { decision: 'dismissed', reason_code: 'firm_standard_wording' }),
  ];
  const answers: FundDecision[] = [
    decision(4, P_BROKEN, {
      decision: 'answered',
      counsel_option: 'A',
      counsel_note: 'Custodial accounts use the custodian pages; the reference is a leftover.',
    }),
    decision(5, P_OVERLAP, {
      decision: 'answered',
      counsel_option: 'B',
      counsel_note: 'Keep the ranges; the administrator reads the lower box.',
    }),
    decision(6, P_EDIT_I, {
      decision: 'answered',
      counsel_option: 'A',
      counsel_note: 'IRA subscribers complete the custodian section.',
    }),
  ];
  out.set(
    `${MEMORY_DIR}/fund-I-decisions.json`,
    json({ version: 1, firm_id: FUND_FIRM, fund: 'fund-I', decisions }),
  );
  out.set(
    `${MEMORY_DIR}/fund-I-answers.json`,
    json({ version: 1, firm_id: FUND_FIRM, fund: 'fund-I', answers }),
  );

  type Active = Pick<ActiveDecision, 'fingerprint' | 'status' | 'decision' | 'counsel_option'> & {
    law_firm_id: string;
  };
  const active: Active[] = [...decisions, ...answers].map((d) => ({
    law_firm_id: d.law_firm_id,
    fingerprint: d.fingerprint,
    decision: d.decision,
    status: 'active',
    ...(d.counsel_option ? { counsel_option: d.counsel_option } : {}),
  }));
  const labelOf = (f: Finding, firm: string): MemoryLabel => {
    const fp = fingerprintFor(f, firm)!;
    const d = active.find((x) => x.fingerprint === fp && x.law_firm_id === firm) ?? null;
    return resolveLabel({ ...f, fingerprint: fp }, d);
  };

  const passages = FUND_II_PASSAGES.flatMap((ps) => {
    const f2 = findingFor(fII, ps.line, 'fund II');
    const fy = findingFor(fY, ps.line, 'fund Y');
    const base = {
      key: ps.key,
      quote: f2.quote,
      issue_class: f2.issue_class,
      severity: f2.severity,
      blocking: isBlocking(f2.severity),
      detector_id: f2.detector_id,
      pattern_key: f2.pattern_key ?? null,
      quote_hash: f2.quote_hash,
    };
    const row2 = {
      ...base,
      fund: 'fund-II',
      firm_id: FUND_FIRM,
      fingerprint: fingerprintFor(f2, FUND_FIRM)!,
      label: labelOf(f2, FUND_FIRM),
      category: ps.category,
      ...(ps.category === 'edited'
        ? { edited_from: plain(P_EDIT_I), fund_I_fingerprint: answers[2]!.fingerprint }
        : {}),
    };
    const rowY = {
      ...base,
      fund: 'fund-Y',
      firm_id: OTHER_FIRM,
      fingerprint: fingerprintFor(fy, OTHER_FIRM)!,
      label: labelOf(fy, OTHER_FIRM),
      category: 'new' as const,
    };
    return [row2, rowY];
  });
  const ii = passages.filter((x) => x.fund === 'fund-II');
  const count = (c: string) => ii.filter((x) => x.category === c).length;
  const handled = ii.filter((x) => x.label !== 'new').length;
  const summary = {
    fund_II_findings: ii.length,
    previously_dismissed: count('previously_dismissed'),
    already_answered: count('already_answered'),
    new: count('new'),
    edited: count('edited'),
    handled,
    need_action: ii.length - handled,
    fewer_to_review_pct: Math.round((handled / ii.length) * 1000) / 10,
  };
  if (summary.handled !== 5 || summary.need_action !== 3 || summary.fewer_to_review_pct !== 62.5)
    throw new Error(`AC59 arithmetic broken: ${JSON.stringify(summary)}`);
  out.set(
    `${MEMORY_DIR}/fund-expectations.json`,
    json({
      version: 1,
      note: 'GENERATED by scripts/src/fixtures/build-seeded.ts (pnpm --filter @aduin/scripts fixtures:build). Labels and fingerprints come from real engine output; firm identity lives here, not in the HTML. category "edited" resolves to label "new" (fingerprint mismatch).',
      funds: Object.fromEntries(
        Object.entries(FUNDS).map(([id, f]) => [
          id,
          {
            file: f.file,
            firm_id: f.firm_id,
            fund_name: f.fund_name,
            findings: id === 'fund-I' ? fI.length : id === 'fund-II' ? fII.length : fY.length,
          },
        ]),
      ),
      summary,
      passages,
    }),
  );
  return out;
}

// ---------------------------------------------------------------- demo seed spec (C3/C4, M7)
const SAMPLE_FUNDS: Record<string, string> = {
  '03': 'Partners Group Private Equity (Master Fund)',
  '05': 'Partners Group Next Generation Infrastructure',
  '06': 'Partners Group Next Generation Infrastructure',
};

export function buildDemoSeedSpec(): DemoSeedSpec {
  const pick = (sampleId: string, pred: (f: Finding) => boolean, what: string): Finding => {
    const hit = sampleFindings(sampleId).filter(pred);
    if (hit.length !== 1)
      throw new Error(`#${sampleId} ${what}: expected 1 finding, got ${hit.length}`);
    return hit[0]!;
  };
  const placeholder = (s: string) =>
    pick(s, (f) => f.pattern_key === 'flag-placeholder:insert', 'placeholder insert');
  const base = (i: number, sampleId: string, f: Finding) => ({
    id: `sd${String(i).padStart(2, '0')}`,
    law_firm_id: DEMO_FIRM,
    sample_id: sampleId,
    issue_class: f.issue_class,
    quote: f.quote,
    ...(f.pattern_key ? { pattern_key: f.pattern_key } : {}),
    section_path: f.section_path,
    fund_name: SAMPLE_FUNDS[sampleId]!,
    doc_version_label: sampleId === '03' ? '2019' : sampleId === '05' ? '2024' : '2026',
    decided_by_name: ANALYST,
    decided_at: DECIDED_AT + i * 60_000,
  });
  const spec: DemoSeedSpec = {
    version: 1,
    workspace: { id: 'ws_demo', name: 'Demo workspace (seeded)' },
    decisions: [
      // M7: three same-pattern, same-reason dismissals across #3, #5, #6 -> rule suggestion
      {
        ...base(1, '03', placeholder('03')),
        decision: 'dismissed',
        reason_code: 'firm_standard_wording',
        note: 'The administrator fills in the investor name on the wire line.',
      },
      {
        ...base(2, '05', placeholder('05')),
        decision: 'dismissed',
        reason_code: 'firm_standard_wording',
      },
      {
        ...base(3, '06', placeholder('06')),
        decision: 'dismissed',
        reason_code: 'firm_standard_wording',
      },
      // C3 fallback: shared non-blocking fingerprints (only 2 exist across #3-#6) ...
      {
        ...base(
          4,
          '03',
          pick('03', (f) => f.pattern_key === 'flag-sensitive:aba', 'aba'),
        ),
        decision: 'dismissed',
        reason_code: 'no_form_impact',
        note: 'Fund wire details; masked in the digitized form.',
      },
      {
        ...base(
          5,
          '03',
          pick('03', (f) => f.pattern_key === 'flag-sensitive:dda', 'dda'),
        ),
        decision: 'dismissed',
        reason_code: 'no_form_impact',
      },
      // ... plus counsel-answered swapped references (blocking: "Already answered" on #5)
      {
        ...base(
          6,
          '03',
          pick(
            '03',
            (f) =>
              f.detector_id === 'ref-label-coherence' && f.quote.includes('Custodian indicated'),
            'swapped custodian ref',
          ),
        ),
        decision: 'answered',
        counsel_option: 'A',
        counsel_note: 'Should read Section 4 (Custodian Information).',
      },
      {
        ...base(
          7,
          '03',
          pick(
            '03',
            (f) => f.detector_id === 'ref-label-coherence' && f.quote.includes('amount specified'),
            'swapped amount ref',
          ),
        ),
        decision: 'answered',
        counsel_option: 'A',
        counsel_note: 'Should read Part B of Section 6 (Investment amount).',
      },
    ],
    rules: [
      {
        id: 'sr01',
        law_firm_id: DEMO_FIRM,
        text: 'Placeholders for the investor name on the wire "FFC" line are firm standard wording.',
        status: 'proposed',
        pattern_key: 'flag-placeholder:insert',
      },
    ],
  };
  return DemoSeedSpecSchema.parse(spec);
}

// ---------------------------------------------------------------- assemble
export function buildFixtures(): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of SEEDED) {
    for (const k of c.cases) out.set(`${SEEDED_DIR}/${c.detector}/${k.file}`, html(k.lines));
    out.set(
      `${SEEDED_DIR}/${c.detector}/expected.json`,
      json({
        version: 1,
        detector: c.detector,
        issue_class: c.issue_class,
        cases: c.cases.map((k) => ({ file: k.file, kind: k.kind, note: k.note, expect: k.expect })),
      }),
    );
  }
  for (const [k, v] of buildMemory()) out.set(k, v);
  out.set(`${MEMORY_DIR}/demo-seed-spec.json`, json(buildDemoSeedSpec()));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = buildFixtures();
  for (const [rel, content] of files) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  console.log(`fixtures:build wrote ${files.size} files`);
}
