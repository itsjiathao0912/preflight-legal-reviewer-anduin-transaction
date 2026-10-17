/**
 * fixtures/variance (Variance MVP Phase 01, H2): a deterministic, self-contained corpus.
 *  - hartwell-crane/{fund-I,fund-II,fund-III,fund-III-with-appendix-c}.html: the Hartwell & Crane
 *    demo pair (Fund III vs Fund II: 214 raw changes = 207 cosmetic in 5 groups + 7 shown) and the
 *    R-01 chain (Fund I has Appendix C; Fund II references it but lacks it; Fund III lacks it)
 *  - seeded/<case>-{a,b}.html: cosmetic traps, the 7 demo items one per pair, edge traps, impact
 *  - expected/*.json: HAND-AUTHORED expectations (never computed from the engine)
 * No timestamps, no randomness except a fixed-seed generator. Invoked from `build-seeded.ts`
 * (`buildFixtures`); `json` is imported from there and used only inside functions (circular).
 * `fixtures/variance/` is prettier-ignored, so HTML lines are not wrapped.
 */
import { json } from './build-seeded';

export const VARIANCE_DIR = 'fixtures/variance';
export const FIRM_ID = 'hartwell-crane';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const P = (t: string) => `<p>${esc(t)}</p>`;
const B = (t: string) => `<p><b>${esc(t)}</b></p>`;
const SEC = (n: string, t: string) => B(`${n}. ${t}`);
const PART = (l: string, t: string) => B(`Part ${l} – ${t}`);
const OPT = (t: string) => P(`☐ ${t}`);

function page(lines: string[]): string {
  return `<html>\n  <body>\n${lines.map((l) => `    ${l}`).join('\n')}\n  </body>\n</html>\n`;
}

// ------------------------------------------------------------------ Hartwell & Crane demo docs

export interface FundVariant {
  /** Roman numeral of the fund ("Fund II"). */
  roman: 'I' | 'II' | 'III';
  /** Fund III numbering: Fund II sections 9..16 become 8..15 (Fund II skips 8). */
  renumbered: boolean;
  term: 'Units' | 'Shares';
  /** Fund III spelling (e-mail -> email, serial comma dropped, internet, web site). */
  fmtNew: boolean;
  datesNew: boolean;
  /** The 7 demo items (7A, Singapore, 8(f), 4.2, Class A minimum, tax status, trust split). */
  demo: boolean;
  appendixC: boolean;
}

export const FUND_I: FundVariant = {
  roman: 'I',
  renumbered: false,
  term: 'Units',
  fmtNew: false,
  datesNew: false,
  demo: false,
  appendixC: true,
};
export const FUND_II: FundVariant = { ...FUND_I, roman: 'II', appendixC: false };
export const FUND_III: FundVariant = {
  roman: 'III',
  renumbered: true,
  term: 'Shares',
  fmtNew: true,
  datesNew: true,
  demo: true,
  appendixC: false,
};
export const FUND_III_WITH_C: FundVariant = { ...FUND_III, appendixC: true };

/** Authored counts of each cosmetic family in the Fund II text (Fund II -> Fund III). */
export interface AuthoredCounts {
  renumberHeadings: number;
  renumberRefs: number;
  fundName: number;
  dateParts: number;
  term: number;
  format: number;
}

const TOPIC: Record<number, string> = {
  9: 'representations',
  10: 'payment',
  11: 'tax',
  12: 'qualified client',
  13: 'privacy',
  14: 'notice',
  15: 'governing law',
  16: 'signature',
};

const REF_TEMPLATES: Array<(s: string, topic: string) => string> = [
  (s, t) => `The ${t} provisions in ${s} apply to every subscription under this Agreement.`,
  (s, t) => `Further detail on the ${t} rules is given in ${s}.`,
  (s, t) => `Read ${s} together with this paragraph when reviewing the ${t} terms.`,
  (s, t) => `Any question on the ${t} terms is resolved under ${s} before the closing.`,
  (s, t) => `The Investor confirms that it has read ${s} on the ${t} terms.`,
];
const FUND_TEMPLATES: Array<(f: string) => string> = [
  (f) => `This paragraph forms part of the subscription documents of ${f}.`,
  (f) => `The general partner of ${f} keeps a copy of this page.`,
  (f) => `Records kept by ${f} are available to the Investor on request.`,
  (f) => `The register of ${f} is maintained by the fund administrator.`,
];
const TERM_TEMPLATES: Array<(u: string) => string> = [
  (u) => `The number of the ${u} issued to the Investor is recorded in the register.`,
  (u) => `Each holder of the ${u} receives a quarterly report.`,
  (u) => `A transfer of the ${u} needs the written consent of the general partner.`,
  (u) => `Distributions on the ${u} are paid in the order set by the partnership agreement.`,
];

interface Ctx {
  v: FundVariant;
  counts: AuthoredCounts;
}

/** Section label: Fund II numbering n -> displayed number for this variant. */
const num = (c: Ctx, n: number) => (c.v.renumbered && n >= 9 ? String(n - 1) : String(n));

function fund(c: Ctx): string {
  c.counts.fundName++;
  return `Harbor Ridge Opportunity Fund ${c.v.roman}, L.P.`;
}
function ref(c: Ctx, n: number): string {
  if (n >= 9) c.counts.renumberRefs++;
  return `Section ${num(c, n)}`;
}
function term(c: Ctx): string {
  c.counts.term++;
  return c.v.term;
}
function heading(c: Ctx, n: number, title: string): string {
  if (n >= 9) c.counts.renumberHeadings++;
  return SEC(num(c, n), title);
}

/** Body sentences for one section: `refs` cross-references, `funds` fund names, `terms` Units. */
function filler(c: Ctx, seed: number, refs: number[], funds: number, terms: number): string[] {
  const out: string[] = [];
  refs.forEach((n, i) => {
    out.push(
      P(REF_TEMPLATES[(seed + i) % REF_TEMPLATES.length]!(ref(c, n), TOPIC[n] ?? 'general')),
    );
    if (i < funds) out.push(P(FUND_TEMPLATES[(seed + i) % FUND_TEMPLATES.length]!(fund(c))));
    if (i < terms) out.push(P(TERM_TEMPLATES[(seed + i) % TERM_TEMPLATES.length]!(term(c))));
  });
  for (let i = refs.length; i < funds; i++)
    out.push(P(FUND_TEMPLATES[(seed + i) % FUND_TEMPLATES.length]!(fund(c))));
  for (let i = refs.length; i < terms; i++)
    out.push(P(TERM_TEMPLATES[(seed + i) % TERM_TEMPLATES.length]!(term(c))));
  return out;
}

/** Cyclic list of moved targets (Fund II sections 9..16), `k` refs starting at `from`. */
const targets = (from: number, k: number) =>
  Array.from({ length: k }, (_, i) => 9 + ((from + i) % 8));

export function fundDoc(v: FundVariant): { html: string; counts: AuthoredCounts } {
  const c: Ctx = {
    v,
    counts: { renumberHeadings: 0, renumberRefs: 0, fundName: 0, dateParts: 0, term: 0, format: 0 },
  };
  const date = (oldD: string, newD: string) => {
    c.counts.dateParts += 2; // month + year (the day is unchanged)
    return v.datesNew ? newD : oldD;
  };
  const fmt = (oldT: string, newT: string) => {
    c.counts.format++;
    return v.fmtNew ? newT : oldT;
  };
  const L: string[] = [];
  // cover (the document preamble: a scope unit)
  L.push(B('SUBSCRIPTION AGREEMENT'));
  L.push(P(fund(c)));
  L.push(P('Prepared by Hartwell & Crane LLP for the general partner'));
  L.push(P(`Dated as of ${date('March 3, 2024', 'June 3, 2026')}`));
  L.push(P(`Offering memorandum dated ${date('February 12, 2024', 'August 12, 2026')}`));
  L.push(P(`Initial closing expected on ${date('April 30, 2024', 'October 30, 2026')}`));
  L.push(P(`Final closing no later than ${date('December 15, 2024', 'January 15, 2027')}`));
  L.push(P(`This agreement governs subscriptions for limited partnership interests in ${fund(c)}`));
  L.push(P(`Questions about this form go to the investor relations team of ${fund(c)}`));

  L.push(heading(c, 1, 'Purpose of this Agreement'));
  L.push(P('This Agreement sets out the terms on which the Investor subscribes.'));
  L.push(...filler(c, 0, targets(0, 8), 3, 2));
  L.push(P('Each Investor shall complete the investor questionnaire in Appendix C.'));

  L.push(heading(c, 2, 'Investor Information'));
  L.push(P('Complete Parts A to C of this Section 2 in full.'));
  L.push(PART('A', 'Investor Domicile'));
  L.push(
    P(
      'The Investor must be domiciled in one of the following jurisdictions: the United States, the Cayman Islands or Luxembourg.',
    ),
  );
  if (v.demo)
    L.push(
      P(
        'Singapore is also accepted as a domicile for investors who subscribe through the Singapore feeder vehicle.',
      ),
    );
  L.push(...filler(c, 1, targets(1, 4), 1, 1));
  L.push(PART('B', 'Investor Type'));
  L.push(P('Investor type (check one):'));
  L.push(OPT('Individual'));
  L.push(OPT('Joint tenants'));
  L.push(OPT(v.demo ? 'Revocable trust or irrevocable trust' : 'Trust'));
  L.push(OPT('IRA'));
  L.push(OPT('Corporation'));
  L.push(OPT('Partnership or LLC'));
  L.push(P('If the Investor is a trust, corporation or partnership, also complete Section 3.'));
  L.push(...filler(c, 2, targets(2, 4), 1, 1));
  L.push(PART('C', 'Tax Status'));
  L.push(
    P(
      `Tax status of the Investor (${v.demo ? 'select all that apply' : 'select one'}): US taxable, US tax-exempt or non-US.`,
    ),
  );
  L.push(...filler(c, 3, targets(3, 4), 1, 1));

  L.push(heading(c, 3, 'Supporting Entity Documents'));
  L.push(P('Entity investors attach their formation documents and a list of authorized signers.'));
  L.push(...filler(c, 4, targets(4, 8), 3, 2));

  L.push(heading(c, 4, 'Beneficial Owners'));
  L.push(P('4.1 Each Investor shall identify the natural persons who control it.'));
  L.push(
    P(
      `4.2 Each Investor that is an entity ${v.demo ? 'formed or organized outside the United States ' : ''}shall provide the names of its beneficial owners.`,
    ),
  );
  L.push(P('4.3 The information given under this Section 4 is kept confidential.'));
  L.push(...filler(c, 5, targets(5, 8), 3, 2));

  L.push(heading(c, 5, 'Custodian and Payment Agent'));
  L.push(P('The custodian holds the subscription monies until the closing.'));
  L.push(...filler(c, 6, targets(6, 8), 3, 2));

  L.push(heading(c, 6, 'Subscription'));
  L.push(PART('A', 'Share Class'));
  L.push(P('The Investor subscribes for Class A interests unless it is eligible for Class S.'));
  L.push(...filler(c, 7, targets(7, 4), 1, 1));
  L.push(PART('B', 'Minimum Subscription'));
  L.push(
    P(
      `The minimum initial subscription amount for Class A is US$ ${v.demo ? '500,000' : '250,000'}.`,
    ),
  );
  L.push(...filler(c, 0, targets(0, 4), 1, 1));

  L.push(heading(c, 7, 'Anti-Money Laundering'));
  L.push(
    P(
      `The Investor provides the identification documents requested under the ${fmt('anti-money', 'anti money')} laundering program.`,
    ),
  );
  L.push(...filler(c, 1, targets(1, 8), 3, 2));
  if (v.demo) L.push(SEC('7A', 'Source of Funds Verification'));

  L.push(heading(c, 9, 'Representations of the Subscriber'));
  L.push(P('(a) The Subscriber has full power and authority to enter into this Agreement.'));
  L.push(P('(b) The Subscriber has read the offering memorandum in full.'));
  L.push(P('(c) The Subscriber is acquiring its interest for investment purposes.'));
  L.push(P('(d) The Subscriber has obtained its own tax and legal advice.'));
  L.push(P('(e) The information given in this Agreement is complete and accurate.'));
  if (v.demo)
    L.push(
      P(
        '(f) The Subscriber represents that neither it nor any of its beneficial owners is the subject of sanctions administered by OFAC or any equivalent authority.',
      ),
    );
  L.push(...filler(c, 2, targets(2, 8), 3, 2));

  L.push(heading(c, 10, 'Payment Instructions'));
  L.push(P('Subscription monies are paid by wire transfer to the subscription account.'));
  L.push(
    P(`The wire must state the Investor's name, the fund name${fmt(',', '')} and the amount.`),
  );
  L.push(...filler(c, 3, targets(3, 8), 3, 2));

  L.push(heading(c, 11, 'Tax Matters'));
  L.push(P('The Investor delivers the applicable tax forms with this Agreement.'));
  L.push(
    P(`Tax forms are available on the ${fmt('Internet', 'internet')} page of the administrator.`),
  );
  L.push(...filler(c, 4, targets(4, 8), 3, 2));

  L.push(heading(c, 12, 'Qualified Client Status'));
  L.push(P('The Investor states whether it meets the qualified client test.'));
  L.push(...filler(c, 5, targets(5, 8), 3, 2));

  L.push(heading(c, 13, 'Privacy and Data Protection'));
  L.push(
    P(
      `Personal data is processed as described in the privacy notice on the administrator ${fmt('website', 'web site')}.`,
    ),
  );
  L.push(P(`The privacy notice is also published on the ${fmt('Internet', 'internet')} archive.`));
  L.push(...filler(c, 6, targets(6, 8), 2, 2));

  L.push(heading(c, 14, 'Notices'));
  L.push(
    P(`Notices to the Investor are sent by ${fmt('e-mail', 'email')} to the address it gives.`),
  );
  L.push(P(`Notices to the general partner are sent by ${fmt('e-mail', 'email')} to its office.`));
  L.push(P(`A notice sent by ${fmt('e-mail', 'email')} is treated as received on the next day.`));
  L.push(P(`The Investor keeps its ${fmt('e-mail', 'email')} address up to date.`));
  L.push(P(`The Investor gives its name, address${fmt(',', '')} and telephone number.`));
  L.push(P(`Forms are listed on the administrator ${fmt('website', 'web site')} for download.`));
  L.push(...filler(c, 7, targets(7, 4), 1, 1));

  L.push(heading(c, 15, 'Governing Law'));
  L.push(P('This Agreement is governed by the laws of the State of New York.'));
  L.push(...filler(c, 0, targets(0, 4), 1, 1));

  L.push(heading(c, 16, 'Signatures'));
  L.push(P('The Investor signs below to accept these terms.'));
  L.push(...filler(c, 1, targets(1, 2), 1, 1));
  L.push(P(`"${term(c)}" means the limited partnership interests offered under this Agreement.`));

  L.push(B('APPENDIX A – ACCREDITED INVESTOR CERTIFICATE'));
  L.push(P('The Investor certifies that it is an accredited investor under the applicable rules.'));
  L.push(P(`This certificate is delivered to ${fund(c)}`));
  if (v.appendixC) {
    L.push(B('APPENDIX C – INVESTOR QUESTIONNAIRE'));
    L.push(P('The Investor answers each question in this questionnaire.'));
    L.push(P('The questionnaire covers investment experience and source of wealth.'));
  }
  return { html: page(L), counts: c.counts };
}

/** The demo item table (hand-authored): unit key in Fund III, class, rule id, owners. */
export const DEMO_ITEMS = [
  {
    id: '7A',
    label: 'New Section 7A "Source of Funds Verification"',
    unit_key_b: 'body:1/s7a',
    class: 'new',
    rule_id: 'VAR-NEW-UNIT',
    owners: ['fund_admin'],
    passage: '7A. Source of Funds Verification',
  },
  {
    id: 'singapore',
    label: 'Singapore added to the Investor domicile list',
    unit_key_b: 'body:1/s2/pa',
    class: 'new',
    rule_id: 'VAR-NEW-INSERTION',
    owners: ['gp', 'counsel'],
    passage: 'Singapore is also accepted as a domicile',
  },
  {
    id: 'sanctions',
    label: 'New sanctions representation 8(f)',
    unit_key_b: 'body:1/s8',
    class: 'new',
    rule_id: 'VAR-NEW-INSERTION',
    owners: ['counsel'],
    passage: 'subject of sanctions administered by OFAC',
  },
  {
    id: '4.2',
    label: 'Section 4.2 now applies only to non-US entities',
    unit_key_b: 'body:1/s4',
    class: 'changed_logic',
    rule_id: 'VAR-LOGIC-GUARD-JURISDICTION',
    owners: ['counsel'],
    passage: 'formed or organized outside the United States',
  },
  {
    id: 'class-a-minimum',
    label: 'Class A minimum raised to US$ 500,000',
    unit_key_b: 'body:1/s6/pb',
    class: 'changed_logic',
    rule_id: 'VAR-LOGIC-GUARD-DIGIT',
    owners: ['gp'],
    passage: '500,000',
  },
  {
    id: 'tax-status',
    label: 'Tax status is now "select all that apply"',
    unit_key_b: 'body:1/s2/pc',
    class: 'changed_logic',
    rule_id: 'VAR-LOGIC-DEFAULT',
    owners: ['counsel'],
    passage: 'select all that apply',
  },
  {
    id: 'trust-split',
    label: 'Trust split into revocable and irrevocable',
    unit_key_b: 'body:1/s2/pb',
    class: 'changed_logic',
    rule_id: 'VAR-LOGIC-GUARD-INVESTOR',
    owners: ['gp'],
    passage: 'Revocable trust or irrevocable trust',
  },
] as const;

// ------------------------------------------------------------------ seeded trap pairs

interface SeedOpts {
  gap?: boolean;
  roman?: string;
  fundNames?: number;
  date?: string;
  term?: string;
  mail?: string;
  inet?: string;
  edits?: Partial<Record<string, string>>;
  extra?: Partial<Record<string, string[]>>;
  replaceSection?: Partial<Record<string, string[]>>;
}

/**
 * Small base document for the seeded pairs (Kestrel Point Income Fund). Sections 1..6 (or
 * 1,2,3,5,6,7 with `gap`); `edits` swap named sentences, `extra` appends blocks after a section's
 * body, `replaceSection` replaces a section's body.
 */
function seedDoc(o: SeedOpts = {}): string {
  const roman = o.roman ?? 'II';
  const name = `Kestrel Point Income Fund ${roman}, L.P.`;
  const S = (n: number) => String(o.gap && n >= 4 ? n + 1 : n);
  const e = (k: string, def: string) => o.edits?.[k] ?? def;
  const sec = (n: number, title: string, body: string[]) => {
    const key = `s${n}`;
    return [SEC(S(n), title), ...(o.replaceSection?.[key] ?? body), ...(o.extra?.[key] ?? [])];
  };
  const term = o.term ?? 'Units';
  const L: string[] = [
    B('SUBSCRIPTION AGREEMENT'),
    P(name),
    P(`Dated as of ${o.date ?? 'March 3, 2024'}`),
    P('Prepared by Hartwell & Crane LLP'),
    ...sec(1, 'Investor Information', [
      P(e('s1-intro', 'The Investor completes this Section 1 in full.')),
      P('Investor type (check one):'),
      OPT('Individual'),
      OPT(e('trust-opt', 'Trust')),
      OPT('Corporation'),
      OPT('IRA'),
      P(e('cond', `If the Investor is a trust, complete Section ${S(5)}.`)),
      P(
        e(
          'domicile',
          'The Investor must be domiciled in the United States, the Cayman Islands or Luxembourg.',
        ),
      ),
      P(e('tax', 'Tax status of the Investor (select one): US taxable, US tax-exempt or non-US.')),
    ]),
    ...sec(2, 'Beneficial Owners', [
      P(
        e(
          'bo',
          'Each Investor that is an entity shall provide the names of its beneficial owners.',
        ),
      ),
      P(e('bo-days', 'The names are delivered within 10 days of the closing.')),
      P(e('register', `The register of ${name} records the beneficial owners.`)),
    ]),
    ...sec(3, 'Subscription', [
      P(e('minimum', 'The minimum initial subscription amount for Class A is US$ 250,000.')),
      P(e('modal', 'The general partner may accept a smaller amount for existing holders.')),
      P(e('dated', 'Subscriptions received after December 31, 2024 are held to the next closing.')),
      P(`Each holder of the ${term} receives a quarterly report.`),
      P(`A transfer of the ${term} needs written consent.`),
      P(`See Section ${S(5)} for the payment terms.`),
    ]),
    ...sec(4, 'Representations', [
      P('(a) The Subscriber has full power to enter into this Agreement.'),
      P(e('rep-b', '(b) The Subscriber will comply with the transfer rules.')),
      P(e('ref-static', 'The tax terms in Section 2 apply to every Investor.')),
    ]),
    ...sec(5, 'Payment', [
      P('Subscription monies are paid by wire transfer.'),
      P(`Notices are sent by ${o.mail ?? 'e-mail'} to the address in the register.`),
      P(`Reports are published on the ${o.inet ?? 'Internet'} page of the administrator.`),
      P(`A copy goes by ${o.mail ?? 'e-mail'} to the custodian.`),
      P(`Payments on the ${term} are made in US dollars.`),
    ]),
    ...sec(6, 'Signatures', [
      P('The Investor signs below.'),
      P(`See Section ${S(5)} before signing.`),
      P(`"${term}" means the limited partnership interests in ${name}`),
    ]),
    B('APPENDIX A – ACCREDITED INVESTOR CERTIFICATE'),
    P(e('appendix', 'The Investor certifies that it is an accredited investor.')),
  ];
  return page(L);
}

/** Deterministic pseudo-random words (fixed seed) for the truncated trap. */
function words(seed: number, n: number): string {
  let x = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out.push(`w${(x >>> 8).toString(36)}`);
  }
  return out.join(' ');
}

export interface SeedCase {
  id: string;
  kind: 'cosmetic' | 'logic' | 'edge' | 'impact';
  note: string;
  a: string;
  b: string;
  /** Hand-authored expectation. */
  expect: {
    shown: number;
    cosmetic: number;
    groups?: Record<string, number>;
    rows?: Array<{
      class: 'new' | 'changed_logic';
      rule_id: string;
      unit_key_b?: string;
      unit_key_a?: string;
      contains: string;
      investor_types_include?: string[];
      investor_types_exclude?: string[];
      conditionals?: number;
      reusable?: 'yes' | 'no';
    }>;
  };
}

export function seedCases(): SeedCase[] {
  const base = seedDoc();
  const C: SeedCase[] = [];
  const add = (c: SeedCase) => C.push(c);
  // cosmetic traps (0 shown rows)
  add({
    id: 'cos-renumber',
    kind: 'cosmetic',
    note: 'Section 4 inserted number gap closed: headings 5->4, 6->5, 7->6; refs to 5 re-pointed',
    a: seedDoc({ gap: true }),
    b: base,
    expect: { shown: 0, cosmetic: 6, groups: { 'VAR-COS-RENUMBER': 6 } },
  });
  add({
    id: 'cos-fund-name',
    kind: 'cosmetic',
    note: 'fund name Fund II -> Fund III (3 occurrences)',
    a: base,
    b: seedDoc({ roman: 'III' }),
    expect: { shown: 0, cosmetic: 3, groups: { 'VAR-COS-NAME:II -> III': 3 } },
  });
  add({
    id: 'cos-cover-date',
    kind: 'cosmetic',
    note: 'cover date month and year (2 hunks)',
    a: base,
    b: seedDoc({ date: 'June 3, 2026' }),
    expect: { shown: 0, cosmetic: 2, groups: { 'VAR-COS-DATE': 2 } },
  });
  add({
    id: 'cos-rename',
    kind: 'cosmetic',
    note: 'defined term Units -> Shares everywhere (4 occurrences)',
    a: base,
    b: seedDoc({ term: 'Shares' }),
    expect: { shown: 0, cosmetic: 4, groups: { 'VAR-COS-RENAME:Units -> Shares': 4 } },
  });
  add({
    id: 'cos-format',
    kind: 'cosmetic',
    note: 'e-mail -> email (2), Internet -> internet (1)',
    a: base,
    b: seedDoc({ mail: 'email', inet: 'internet' }),
    expect: { shown: 0, cosmetic: 3, groups: { 'VAR-COS-FORMAT': 3 } },
  });
  // the 7 demo items, one per pair
  add({
    id: 'item-new-section',
    kind: 'logic',
    note: 'new section 6A (heading only: one block)',
    a: base,
    b: seedDoc({ extra: { s6: [SEC('6A', 'Source of Funds Verification')] } }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [{ class: 'new', rule_id: 'VAR-NEW-UNIT', unit_key_b: 'body:1/s6a', contains: '6A' }],
    },
  });
  add({
    id: 'item-new-sentence',
    kind: 'logic',
    note: 'Singapore sentence of 12+ words inserted',
    a: base,
    b: seedDoc({
      extra: {
        s1: [
          P(
            'Singapore is also accepted as a domicile for investors who subscribe through the Singapore feeder vehicle.',
          ),
        ],
      },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'new',
          rule_id: 'VAR-NEW-INSERTION',
          unit_key_b: 'body:1/s1',
          contains: 'Singapore',
        },
      ],
    },
  });
  add({
    id: 'item-new-paragraph',
    kind: 'logic',
    note: 'sanctions paragraph (c) of 12+ words',
    a: base,
    b: seedDoc({
      extra: {
        s4: [
          P(
            '(c) The Subscriber represents that neither it nor any of its beneficial owners is the subject of sanctions administered by OFAC.',
          ),
        ],
      },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'new',
          rule_id: 'VAR-NEW-INSERTION',
          unit_key_b: 'body:1/s4',
          contains: 'sanctions',
        },
      ],
    },
  });
  add({
    id: 'item-audience',
    kind: 'logic',
    note: '7-word insertion restricts the clause to non-US entities',
    a: base,
    b: seedDoc({
      edits: {
        bo: 'Each Investor that is an entity formed or organized outside the United States shall provide the names of its beneficial owners.',
      },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-GUARD-JURISDICTION',
          unit_key_b: 'body:1/s2',
          contains: 'outside the United States',
          reusable: 'no',
        },
      ],
    },
  });
  add({
    id: 'item-amount',
    kind: 'logic',
    note: 'Class A minimum 250,000 -> 500,000',
    a: base,
    b: seedDoc({
      edits: { minimum: 'The minimum initial subscription amount for Class A is US$ 500,000.' },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-GUARD-DIGIT',
          unit_key_b: 'body:1/s3',
          contains: '500',
        },
      ],
    },
  });
  add({
    id: 'item-select-all',
    kind: 'logic',
    note: 'tax status select one -> select all that apply',
    a: base,
    b: seedDoc({
      edits: {
        tax: 'Tax status of the Investor (select all that apply): US taxable, US tax-exempt or non-US.',
      },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-DEFAULT',
          unit_key_b: 'body:1/s1',
          contains: 'all that apply',
        },
      ],
    },
  });
  add({
    id: 'item-trust-split',
    kind: 'logic',
    note: 'Trust option split',
    a: base,
    b: seedDoc({ edits: { 'trust-opt': 'Revocable trust or irrevocable trust' } }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-GUARD-INVESTOR',
          unit_key_b: 'body:1/s1',
          contains: 'Revocable trust',
          investor_types_include: ['trust'],
        },
      ],
    },
  });
  // edge traps (each must be logic)
  const edge = (
    id: string,
    note: string,
    b: string,
    rule: string,
    unit: string,
    contains: string,
  ) =>
    add({
      id,
      kind: 'edge',
      note,
      a: base,
      b,
      expect: {
        shown: 1,
        cosmetic: 0,
        rows: [{ class: 'changed_logic', rule_id: rule, unit_key_b: unit, contains }],
      },
    });
  edge(
    'edge-date-operative',
    'a date in operative text (not the cover) is logic',
    seedDoc({
      edits: {
        dated: 'Subscriptions received after December 31, 2025 are held to the next closing.',
      },
    }),
    'VAR-LOGIC-GUARD-DIGIT',
    'body:1/s3',
    '2025',
  );
  edge(
    'edge-single-name',
    'a fund-name swap with only 1 occurrence is logic',
    seedDoc({
      edits: {
        register:
          'The register of Kestrel Point Income Fund III, L.P. records the beneficial owners.',
      },
    }),
    'VAR-LOGIC-DEFAULT',
    'body:1/s2',
    'III',
  );
  edge(
    'edge-ref-not-moved',
    'a reference whose target did not move (Section 2 -> Section 3) is logic',
    seedDoc({ edits: { 'ref-static': 'The tax terms in Section 3 apply to every Investor.' } }),
    'VAR-LOGIC-GUARD-DIGIT',
    'body:1/s4',
    'Section 3',
  );
  edge(
    'edge-number',
    'a changed number of days is logic',
    seedDoc({ edits: { 'bo-days': 'The names are delivered within 15 days of the closing.' } }),
    'VAR-LOGIC-GUARD-DIGIT',
    'body:1/s2',
    '15',
  );
  edge(
    'edge-negation',
    'an added negation is logic',
    seedDoc({ edits: { 'rep-b': '(b) The Subscriber will not breach the transfer rules.' } }),
    'VAR-LOGIC-GUARD-NEGATION',
    'body:1/s4',
    'not',
  );
  edge(
    'edge-modal',
    'a changed modal (may -> shall) is logic',
    seedDoc({
      edits: { modal: 'The general partner shall accept a smaller amount for existing holders.' },
    }),
    'VAR-LOGIC-GUARD-MODAL',
    'body:1/s3',
    'shall',
  );
  edge(
    'edge-condition',
    'an added condition word is logic',
    seedDoc({
      edits: { 'rep-b': '(b) The Subscriber will comply with the transfer rules unless waived.' },
    }),
    'VAR-LOGIC-GUARD-CONDITION',
    'body:1/s4',
    'unless',
  );
  edge(
    'edge-truncated',
    'a rewrite beyond the edit bound is one coarse truncated hunk (logic)',
    seedDoc({ replaceSection: { s4: [P(words(7, 1200))] } }),
    'VAR-LOGIC-GUARD-TRUNCATED',
    'body:1/s4',
    'w',
  );
  // impact fixtures (graph-derived)
  add({
    id: 'impact-trust-only',
    kind: 'impact',
    note: 'a change inside a section only trusts complete',
    a: seedDoc({
      extra: {
        s6: [
          SEC('6A', 'Trust Information (Trust Subscribers only)'),
          P('The trustee lists the grantor and the beneficiaries.'),
        ],
      },
    }),
    b: seedDoc({
      extra: {
        s6: [
          SEC('6A', 'Trust Information (Trust Subscribers only)'),
          P('The trustee lists the grantor and the current beneficiaries.'),
        ],
      },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-DEFAULT',
          unit_key_b: 'body:1/s6a',
          contains: 'current',
          investor_types_include: ['trust'],
          investor_types_exclude: ['individual', 'corporation', 'ira'],
          reusable: 'no',
        },
      ],
    },
  });
  add({
    id: 'impact-conditional',
    kind: 'impact',
    note: 'a conditional target changes (Section 5 -> Section 6)',
    a: base,
    b: seedDoc({ edits: { cond: 'If the Investor is a trust, complete Section 6.' } }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-GUARD-DIGIT',
          unit_key_b: 'body:1/s1',
          contains: 'Section 6',
          conditionals: 1,
          reusable: 'no',
        },
      ],
    },
  });
  add({
    id: 'impact-reusable',
    kind: 'impact',
    note: 'a wording change outside every investor path, with no form element: reusable',
    a: base,
    b: seedDoc({
      edits: { appendix: 'The Investor certifies that it is an accredited investor today.' },
    }),
    expect: {
      shown: 1,
      cosmetic: 0,
      rows: [
        {
          class: 'changed_logic',
          rule_id: 'VAR-LOGIC-DEFAULT',
          unit_key_b: 'appendix:a',
          contains: 'today',
          reusable: 'yes',
        },
      ],
    },
  });
  return C;
}

// ------------------------------------------------------------------ assemble

export function buildVarianceFixtures(): Map<string, string> {
  const out = new Map<string, string>();
  const HC = `${VARIANCE_DIR}/hartwell-crane`;
  const docs: Array<[string, FundVariant]> = [
    ['fund-I', FUND_I],
    ['fund-II', FUND_II],
    ['fund-III', FUND_III],
    ['fund-III-with-appendix-c', FUND_III_WITH_C],
  ];
  let counts: AuthoredCounts | undefined;
  for (const [name, v] of docs) {
    const d = fundDoc(v);
    if (name === 'fund-II') counts = d.counts;
    out.set(`${HC}/${name}.html`, d.html);
  }
  const c = counts!;
  const renumber = c.renumberHeadings + c.renumberRefs;
  const cosmetic = renumber + c.fundName + c.dateParts + c.term + c.format;
  const expected = {
    version: 1,
    firm_id: FIRM_ID,
    pair: { baseline: 'hartwell-crane/fund-II.html', current: 'hartwell-crane/fund-III.html' },
    note: 'Authored counts (counted while writing the Fund II text, never read back from the engine). Raw = cosmetic + 7 demo items, each exactly one raw change.',
    raw: cosmetic + DEMO_ITEMS.length,
    shown: DEMO_ITEMS.length,
    new: DEMO_ITEMS.filter((i) => i.class === 'new').length,
    changed_logic: DEMO_ITEMS.filter((i) => i.class === 'changed_logic').length,
    cosmetic,
    groups: {
      'VAR-COS-RENUMBER': renumber,
      'VAR-COS-NAME:II -> III': c.fundName,
      'VAR-COS-DATE': c.dateParts,
      'VAR-COS-RENAME:Units -> Shares': c.term,
      'VAR-COS-FORMAT': c.format,
    },
    authored: c,
    items: DEMO_ITEMS,
    r01: {
      setup_pair: {
        baseline: 'hartwell-crane/fund-I.html',
        current: 'hartwell-crane/fund-II.html',
      },
      removed_unit_key_a: 'appendix:c',
      assertion: { kind: 'scope_exists', label: 'appendix c' },
      statement: 'Appendix C must exist',
      source_fund: 'Fund II',
      violated_in: 'hartwell-crane/fund-III.html',
      holds_in: 'hartwell-crane/fund-III-with-appendix-c.html',
    },
  };
  // the authored split pinned by the plan (118 / 41 / 8 / 29 / 11 = 207)
  const pinned = { renumber: 118, fundName: 41, dates: 8, term: 29, format: 11 };
  const actual = {
    renumber,
    fundName: c.fundName,
    dates: c.dateParts,
    term: c.term,
    format: c.format,
  };
  if (JSON.stringify(pinned) !== JSON.stringify(actual))
    throw new Error(
      `variance corpus: authored split ${JSON.stringify(actual)} != pinned ${JSON.stringify(pinned)}`,
    );
  out.set(`${VARIANCE_DIR}/expected/hartwell-crane.json`, json(expected));

  const cases = seedCases();
  for (const k of cases) {
    out.set(`${VARIANCE_DIR}/seeded/${k.id}-a.html`, k.a);
    out.set(`${VARIANCE_DIR}/seeded/${k.id}-b.html`, k.b);
  }
  out.set(
    `${VARIANCE_DIR}/expected/seeded.json`,
    json({
      version: 1,
      firm_id: FIRM_ID,
      note: 'Hand-authored expectations per seeded pair (a = baseline, b = current).',
      cases: cases.map((k) => ({ id: k.id, kind: k.kind, note: k.note, expect: k.expect })),
    }),
  );
  return out;
}
