/**
 * Package fixtures (intake Phase 1): writes fixtures/package/
 *  - hartwell/fund-iii-subscription-agreement.html   synthetic Hartwell & Crane sub agreement (Fund III)
 *  - hartwell/northgate-lpa-definitions.docx         LPA definitions excerpt (via `docx`, MIT)
 *  - hartwell/fund-ii-subscription-agreement-prior.html  prior Fund II sub agreement (baseline)
 *  - design/<id>/*.docx + design/checksums.json      copies of the read-only samples/packages/**
 *  - expected.json, schema.v1.json, demo-packages.json
 * Synthetic, non-routable data only. Run: `pnpm --filter @aduin/scripts package:fixtures`.
 * The drift gate (`fixtures:check`) rebuilds this in memory and compares (DOCX by zip entries).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { PackageAnalysisSchema } from '@aduin/core';
import { ROOT } from './find-shared-passages';

export const PACKAGE_DIR = 'fixtures/package';
export const HARTWELL_DIR = `${PACKAGE_DIR}/hartwell`;
export const DESIGN_DIR = `${PACKAGE_DIR}/design`;
/** Key order of a committed real-facts file (fixtures:check checks shape only). */
export const REAL_FACTS_KEYS = [
  'id',
  'name',
  'format',
  'titleLines',
  'headText',
  'expectedType',
  'expectedRole',
] as const;

/** Design packages (read-only sources) and their stable fixture ids. */
export const DESIGN_PACKAGES: ReadonlyArray<{ id: string; folder: string }> = [
  { id: 'northgate-iii', folder: '01-northgate-infrastructure-iii' },
  { id: 'lotus-bay-asia-ii', folder: '02-lotus-bay-asia-growth-ii' },
  { id: 'redwood-ridge-i', folder: '03-redwood-ridge-credit-i' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Paragraph wrapped at word boundaries so every source line stays <= 100 chars. */
const wrap = (s: string): string => {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if (cur && cur.length + 1 + w.length > 90) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  out.push(cur);
  return out.join('\n');
};
const p = (s: string) => `<p>${wrap(esc(s))}</p>`;
const h = (s: string) => `<p><b>${esc(s)}</b></p>`;

function subAgreement(fund: 'III' | 'II'): string {
  const name = `NORTHGATE INFRASTRUCTURE FUND ${fund}, L.P.`;
  const body = [
    h(name),
    h('SUBSCRIPTION AGREEMENT'),
    p('Hartwell and Crane LLP prepared this synthetic form for testing only.'),
    h('1. DEFINITIONS'),
    p(
      'Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.',
    ),
    p(
      `This agreement is made by the subscriber (the "Investor") with the partnership (the "Fund").`,
    ),
    p(`The limited partnership interests in the Fund (the "Interests") are offered privately.`),
    h('2. SUBSCRIPTION'),
    p('The Investor agrees to the purchase of the Units described in the Capital Commitment.'),
    p('Payment of the Capital Commitment is due when called by the General Partner on notice.'),
    p('Notices from the General Partner may set any Closing Date for a new subscriber.'),
    p('On each Closing Date the Management Fee starts to accrue on the Capital Commitment.'),
    p('Calls do not apply to any Excused Investor as provided in the Partnership Agreement.'),
    p('Fees are still payable by each Excused Investor on the Management Fee schedule.'),
    p('No Investor may claim that it subscribed for the Stock of any portfolio company.'),
    h('3. ERISA'),
    p('If the Investor is a Benefit Plan Investor, complete Annex F.'),
    p('The Investor shall deliver Annex F (Investor Questionnaire) with this agreement.'),
    h('4. TAX'),
    p('Each non-U.S. Investor shall deliver a properly completed Form W-8BEN-E to the Fund.'),
    p('Any rights granted under a Side Letter apply only to the Investor named in it.'),
    h('5. MISCELLANEOUS'),
    p('The wire details are set out in Annex A and the signature page is in Annex B.'),
    h('Annex A. Wire Instructions'),
    p('Bank: Example Bank. Reference: Fund subscription.'),
    h('Annex B. Signature Page'),
    p('Signature: ____________'),
  ];
  return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>${esc(name)} Subscription Agreement</title>\n</head>\n<body>\n${body.join('\n')}\n</body>\n</html>\n`;
}

export async function lpaDefinitionsDocx(): Promise<Buffer> {
  const def = (term: string, text: string) =>
    new Paragraph({ children: [new TextRun(`“${term}” means ${text}`)] });
  const doc = new Document({
    creator: 'aduin-transaction fixtures',
    title: 'Synthetic LPA definitions',
    sections: [
      {
        children: [
          new Paragraph({
            text: 'AMENDED AND RESTATED LIMITED PARTNERSHIP AGREEMENT',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: 'Northgate Infrastructure Fund III, L.P.' }),
          new Paragraph({
            children: [new TextRun({ text: 'Article I. Definitions', bold: true })],
          }),
          def('Units', 'the limited partnership interests issued by the Partnership.'),
          def('Capital Commitment', 'the amount a Limited Partner agrees to contribute.'),
          def('Closing Date', 'each date on which the General Partner admits Limited Partners.'),
          def('General Partner', 'Northgate Infrastructure GP III, LLC.'),
          def('Management Fee', 'the fee payable to the manager under Article IV.'),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

/** Copies of the design packages, keyed by fixture path, plus their checksums. */
export function designCopies(): { files: Map<string, Buffer>; checksums: string } {
  const files = new Map<string, Buffer>();
  const sums: Record<string, { source: string; sha256: string }> = {};
  for (const d of DESIGN_PACKAGES) {
    const src = join(ROOT, 'samples', 'packages', d.folder, 'docs');
    if (!existsSync(src)) continue;
    for (const f of readdirSync(src).sort()) {
      if (!f.endsWith('.docx')) continue;
      const b = readFileSync(join(src, f));
      const rel = `${DESIGN_DIR}/${d.id}/${f}`;
      files.set(rel, b);
      sums[rel] = { source: `samples/packages/${d.folder}/docs/${f}`, sha256: sha(b) };
    }
  }
  return { files, checksums: JSON.stringify(sums, null, 2) + '\n' };
}

/**
 * Variance Phase 05 (D-S0-7 retag): the firm of each design demo package, from its README (only
 * firms in fixtures/memory/law-firms.json; Redwood Ridge's firm is not listed, so it stays untagged).
 */
export const DESIGN_FIRMS: Record<string, string | null> = {
  'northgate-iii': 'hartwell-crane',
  'lotus-bay-asia-ii': 'ostrander-pell',
  'redwood-ridge-i': null,
};

export function demoPackages(): string {
  const present = DESIGN_PACKAGES.filter((d) =>
    existsSync(join(ROOT, 'samples', 'packages', d.folder, 'docs')),
  );
  const design = present.map((d) => ({
    id: d.id,
    firmId: DESIGN_FIRMS[d.id] ?? null,
    members: readdirSync(join(ROOT, 'samples', 'packages', d.folder, 'docs'))
      .filter((f) => f.endsWith('.docx'))
      .sort()
      .map((f) => `${DESIGN_DIR}/${d.id}/${f}`),
  }));
  const j = {
    primaryDemoId: present.some((d) => d.id === 'northgate-iii') ? 'northgate-iii' : 'hartwell',
    packages: [
      ...design,
      {
        id: 'hartwell',
        firmId: 'firm-x',
        members: [
          `${HARTWELL_DIR}/fund-iii-subscription-agreement.html`,
          `${HARTWELL_DIR}/northgate-lpa-definitions.docx`,
          `${HARTWELL_DIR}/fund-ii-subscription-agreement-prior.html`,
        ],
      },
      { id: 'ngi', firmId: 'partners-group', members: ['sample:05', 'sample:06'] },
      { id: 'rw-scans', firmId: null, members: ['scan:09'] },
      { id: 'blackstone-appendix', firmId: null, members: ['sample:13'] },
    ],
  };
  return JSON.stringify(j, null, 2) + '\n';
}

/**
 * AUTHORED expectations (intake Phase 1). Design-package rows are derived from each package's
 * answer-key.md; measured engine gaps are listed under `knownGaps` (never asserted as passing).
 */
export const EXPECTED = {
  version: 1,
  hartwell: {
    firmId: 'firm-x',
    files: {
      'fund-iii-subscription-agreement.html': {
        type: 'sub_agreement',
        finalRole: 'to_digitize',
        mustBeLow: false,
      },
      'northgate-lpa-definitions.docx': { type: 'lpa', finalRole: 'reference', mustBeLow: false },
      'fund-ii-subscription-agreement-prior.html': {
        type: 'sub_agreement',
        finalRole: 'baseline',
        mustBeLow: true,
      },
    },
    references: [
      {
        label: 'Partnership Agreement',
        family: 'lpa',
        withLpa: 'resolved',
        withoutLpa: 'not_in_package',
        mentions: 2,
      },
      {
        label: 'Annex F',
        family: 'annex',
        withLpa: 'not_in_package',
        withoutLpa: 'not_in_package',
        mentions: 2,
      },
      {
        label: 'Form W-8BEN-E',
        family: 'tax_form',
        withLpa: 'not_in_package',
        withoutLpa: 'not_in_package',
        mentions: 1,
      },
      {
        label: 'Side Letter',
        family: 'side_letter',
        withLpa: 'not_in_package',
        withoutLpa: 'not_in_package',
        mentions: 1,
      },
    ],
    internalLabelsNotExternal: ['Annex A', 'Annex B'],
    terms: {
      withLpa: {
        Units: 'defined_in_package',
        'Capital Commitment': 'defined_in_package',
        'Closing Date': 'defined_in_package',
        'General Partner': 'defined_in_package',
        'Management Fee': 'defined_in_package',
        'Excused Investor': 'unverified',
      },
      withoutLpaReason: 'no_reference_document',
    },
    findingsKept: ['Stock'],
    requests: ['Annex F', 'Form W-8BEN-E', 'Side Letter'],
    requestsWithoutLpa: ['Partnership Agreement', 'Annex F', 'Form W-8BEN-E', 'Side Letter'],
    coverageLine: 'Coverage: partial - 1 term unverified, 4 references not in the package',
  },
  design: {
    'northgate-iii': {
      firmId: DESIGN_FIRMS['northgate-iii'],
      acs: ['AC-I5', 'AC-I9', 'AC-I11', 'AC-I14', 'AC-I15', 'AC-I16', 'AC-I20'],
      files: {
        '01-NG3-Subscription-Agreement.docx': {
          type: 'sub_agreement',
          finalRole: 'to_digitize',
          mustBeLow: true,
        },
        '02-NG3-LPA-Definitions-and-Key-Terms.docx': {
          type: 'lpa',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '03-NG3-PPM-Summary-of-Terms.docx': {
          type: 'ppm',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '04-NG2-Subscription-Agreement-2024.docx': {
          type: 'sub_agreement',
          finalRole: 'baseline',
          mustBeLow: true,
        },
        '05-Meridale-AML-KYC-Requirements.docx': {
          type: 'other',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '06-GP-Email-Requirements-Note.docx': {
          type: 'other',
          finalRole: 'reference',
          mustBeLow: false,
        },
      },
      primary: '01-NG3-Subscription-Agreement.docx',
      notInPackage: [
        'annex:annex f',
        'side_letter',
        'tax_form:form w-9',
        'tax_form:form w-8ben',
        'tax_form:form w-8ben-e',
        'tax_form:form w-8exp',
        'tax_form:form w-8imy',
      ],
      resolved: ['lpa', 'ppm'],
      quotes: [
        'If the Investor is a Benefit Plan Investor, complete Annex F.',
        'Capitalized terms used but not defined herein have the meanings given to them in the Partnership Agreement.',
      ],
      definedInPackage: [
        'Capital Commitment',
        'Capital Contribution',
        'Closing Date',
        'Defaulting Partner',
        'Benefit Plan Investor',
      ],
      requests: [
        'Side Letter',
        'Form W-9',
        'Annex F',
        'Form W-8BEN',
        'Form W-8BEN-E',
        'Form W-8EXP',
        'Form W-8IMY',
      ],
      knownGaps: [
        'D7 Eligible Transferee Certificate is not a reference family and is not listed as a term (used once)',
      ],
    },
    'lotus-bay-asia-ii': {
      firmId: DESIGN_FIRMS['lotus-bay-asia-ii'],
      acs: ['AC-I5', 'AC-I9', 'AC-I12', 'AC-I16', 'AC-I20'],
      files: {
        '01-LB2-Subscription-Agreement-Offshore-v2.docx': {
          type: 'sub_agreement',
          finalRole: 'to_digitize',
          mustBeLow: true,
        },
        '02-LB2-Investor-Questionnaire-Standalone.docx': {
          type: 'other',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '03-LB2-PPM-Summary.docx': { type: 'ppm', finalRole: 'reference', mustBeLow: false },
        '04-LB2-Subscription-Agreement-Offshore-v1-draft.docx': {
          type: 'sub_agreement',
          finalRole: 'baseline',
          mustBeLow: true,
        },
        '05-Sakura-Side-Letter.docx': {
          type: 'side_letter',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '06-Harbourline-W8-Guide.docx': {
          type: 'tax_form',
          finalRole: 'reference',
          mustBeLow: false,
        },
      },
      primary: '01-LB2-Subscription-Agreement-Offshore-v2.docx',
      notInPackage: ['lpa', 'annex:annex c'],
      resolved: [
        'ppm',
        'side_letter',
        'tax_form:form w-8ben',
        'tax_form:form w-8ben-e',
        'tax_form:form w-9',
      ],
      annexCMentions: 3,
      unverified: [
        'Capital Commitment',
        'Drawdown Notice',
        'Defaulting Limited Partner',
        'Carried Interest Escrow',
      ],
      requests: ['Partnership Agreement', 'Annex C'],
      knownGaps: [
        'US Feeder Subscription Agreement is not a reference family (third GP request item missing)',
        'E1 terms Excused Investor and Key Person Event are not listed (fewer than two determiner-led uses)',
      ],
    },
    'redwood-ridge-i': {
      firmId: null,
      acs: ['AC-I5', 'AC-I10', 'AC-I17'],
      files: {
        '01-RR1-Subscription-Agreement.docx': {
          type: 'sub_agreement',
          finalRole: 'to_digitize',
          mustBeLow: false,
        },
        '02-RR1-LPA-Definitions.docx': { type: 'lpa', finalRole: 'reference', mustBeLow: false },
        '03-RR1-PPM-Summary.docx': { type: 'ppm', finalRole: 'reference', mustBeLow: false },
        '04-Pinecroft-AML-KYC-Checklist.docx': {
          type: 'other',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '05-GP-Requirements-Email.docx': {
          type: 'other',
          finalRole: 'reference',
          mustBeLow: false,
        },
        '06-RR1-Tax-Forms-Guide-SCANNED.docx': {
          type: 'tax_form',
          finalRole: 'reference',
          mustBeLow: true,
          needsOcr: true,
        },
      },
      primary: '01-RR1-Subscription-Agreement.docx',
      notInPackage: [
        'side_letter',
        'tax_form:form w-9',
        'tax_form:form w-8ben',
        'tax_form:form w-8ben-e',
        'tax_form:form w-8imy',
      ],
      resolved: ['lpa', 'ppm'],
      definedInPackage: ['Subscription Facility'],
      requests: ['Side Letter', 'Form W-9', 'Form W-8BEN', 'Form W-8BEN-E', 'Form W-8IMY'],
      knownGaps: [
        'F4 terms Plan Assets, Significant Participation and Hurdle Amount are not listed (fewer than two determiner-led uses)',
      ],
    },
  },
  realFacts: {
    'sec-09-s11a-full': { type: 'ppm', mustBeLow: true },
    'sec-13-s11-full': { type: 'ppm', mustBeLow: true },
    'sample-13-appendix-b': { type: 'sub_agreement', mustBeLow: false },
    'scan-09-page-1': { type: 'sub_agreement', mustBeLow: false },
  },
  ngi: {
    files: {
      '05-partners-group-ngi-2024.htm': 'sub_agreement',
      '06-partners-group-ngi-2026.htm': 'sub_agreement',
    },
    recallNouns: ['LLC Agreement', 'Memorandum', 'Prospectus'],
    exclusions: ['this '],
  },
};

/** Every generated package fixture, in memory (text as string, binaries as Buffer). */
export async function buildPackageFixtures(): Promise<Map<string, string | Buffer>> {
  const out = new Map<string, string | Buffer>();
  out.set(`${HARTWELL_DIR}/fund-iii-subscription-agreement.html`, subAgreement('III'));
  out.set(`${HARTWELL_DIR}/fund-ii-subscription-agreement-prior.html`, subAgreement('II'));
  out.set(`${HARTWELL_DIR}/northgate-lpa-definitions.docx`, await lpaDefinitionsDocx());
  const d = designCopies();
  for (const [k, v] of d.files) out.set(k, v);
  if (d.files.size) out.set(`${DESIGN_DIR}/checksums.json`, d.checksums);
  out.set(`${PACKAGE_DIR}/expected.json`, JSON.stringify(EXPECTED, null, 2) + '\n');
  out.set(
    `${PACKAGE_DIR}/schema.v1.json`,
    JSON.stringify(z.toJSONSchema(PackageAnalysisSchema), null, 2) + '\n',
  );
  out.set(`${PACKAGE_DIR}/demo-packages.json`, demoPackages());
  // text fixtures are written prettier-clean (the repo lint runs prettier --check over fixtures/)
  for (const [rel, content] of out) {
    if (typeof content !== 'string') continue;
    const abs = join(ROOT, rel);
    const cfg = (await resolveConfig(abs)) ?? {};
    out.set(rel, await format(content, { ...cfg, filepath: abs }));
  }
  return out;
}

async function main(): Promise<void> {
  for (const [rel, content] of await buildPackageFixtures()) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`wrote ${rel}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
