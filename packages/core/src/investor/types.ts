/**
 * Investor-type vocabulary and path model (core-internal plain data; NOT a v1 contract schema).
 * Vocabulary seeded from samples #1, #7, #10 and the seeded fixtures; unknown labels stay
 * "unclassified" and are never flagged.
 */
export const INVESTOR_TYPES = [
  'individual',
  'joint',
  'trust',
  'ira',
  'custodial',
  'corporation',
  'partnership',
  'other-entity',
  'erisa-plan',
  'estate',
] as const;
export type InvestorTypeId = (typeof INVESTOR_TYPES)[number];

/** Peer families: PATH-04 compares a type only with peers of the same family. */
export const FAMILY: Readonly<Record<InvestorTypeId, 'person' | 'entity' | 'retirement'>> =
  Object.freeze({
    individual: 'person',
    joint: 'person',
    trust: 'entity',
    corporation: 'entity',
    partnership: 'entity',
    'other-entity': 'entity',
    estate: 'entity',
    ira: 'retirement',
    custodial: 'retirement',
    'erisa-plan': 'retirement',
  });

export const TYPE_LABELS: Readonly<Record<InvestorTypeId, string>> = Object.freeze({
  individual: 'Individual',
  joint: 'Joint tenants',
  trust: 'Trust',
  ira: 'IRA',
  custodial: 'Custodial account',
  corporation: 'Corporation',
  partnership: 'Partnership or LLC',
  'other-entity': 'Other entity',
  'erisa-plan': 'ERISA plan',
  estate: 'Estate',
});

/** Ordered: the first matching rule wins (IRA before Individual: "Individual Retirement Account"). */
export const TYPE_RULES: ReadonlyArray<{ id: InvestorTypeId; re: RegExp }> = [
  { id: 'ira', re: /\bIRA\b|individual retirement|\bkeogh\b|\bSEP\b|\broth\b/i },
  { id: 'custodial', re: /custodia|\bUGMA\b|\bUTMA\b|\bUGTA\b|uniform (?:gift|transfer)/i },
  {
    id: 'erisa-plan',
    re: /\bERISA\b|employee benefit plan|pension|profit[- ]sharing|qualified plan|retirement plan|\b401\b/i,
  },
  { id: 'joint', re: /\bjoint\b|tenants in common|community property|tenants by the entirety/i },
  { id: 'trust', re: /\btrusts?\b/i },
  { id: 'estate', re: /\bestates?\b/i },
  { id: 'corporation', re: /\bcorporations?\b|\b[SC][- ]?corp\b/i },
  { id: 'partnership', re: /\bpartnerships?\b|\bLLCs?\b|limited liability/i },
  {
    id: 'other-entity',
    re: /\bother entity\b|\bfoundation\b|\bendowment\b|\bcharity\b|exempt organization/i,
  },
  { id: 'individual', re: /\bindividuals?\b|\bnatural person\b|\bsingle owner\b/i },
];

/** Labels longer than this are sentences (e.g. accredited-investor reps), not type options. */
export const TYPE_LABEL_MAX = 80;

export function classifyType(label: string): InvestorTypeId | null {
  if (label.length > TYPE_LABEL_MAX) return null;
  for (const r of TYPE_RULES) if (r.re.test(label)) return r.id;
  return null;
}

/** Every type a free-text trigger names ("If the Subscriber is a trust or an estate"). */
export function typesIn(text: string): InvestorTypeId[] {
  const out: InvestorTypeId[] = [];
  for (const r of TYPE_RULES) if (r.re.test(text) && !out.includes(r.id)) out.push(r.id);
  return out;
}

export interface InvestorTypeEntry {
  id: InvestorTypeId;
  /** Option label as printed (first occurrence). */
  label: string;
  blockIndex: number;
  /** Footnote marker on this type's option, if any (HTML <sup>). */
  footnote?: string;
}

export interface PathCitation {
  /** Clause text (masked by the caller before display). */
  text: string;
  blockIndex: number;
  start: number;
  end: number;
}

export interface PathGap {
  kind: 'part-c' | 'peer-item';
  /** What is missing ("Part C of Section 3", "footnote 2"). */
  item: string;
  /** Peer types that carry it (peer-item only). */
  peers: InvestorTypeId[];
  citation: PathCitation;
}

export interface InvestorPath {
  type: InvestorTypeId;
  label: string;
  /** Applicable section numbers in document order. */
  sections: string[];
  /** Skipped section numbers in document order. */
  skipped: string[];
  /** Questions = option groups / fields inside applicable sections (short labels, in order). */
  questions: Array<{ section: string; text: string }>;
  /** Items this type is told to complete ("Part C of Section 3"). */
  required: string[];
  reachesCompletion: boolean;
  /** The graph could not be proven (no completion node, unparsed routing): never asserted. */
  uncertain: boolean;
  citations: PathCitation[];
  gaps: PathGap[];
  /** Dead-end cause when !reachesCompletion && !uncertain. */
  deadEnd?: { reason: string; citation: PathCitation };
}

export interface InvestorModel {
  types: InvestorTypeEntry[];
  paths: InvestorPath[];
  /** Completion node label ("Section 6 (Signature)") or null when none was found. */
  completion: string | null;
}
