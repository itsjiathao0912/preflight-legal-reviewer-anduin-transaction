import {
  PackagePolicySchema,
  type CoverageGroupId,
  type PackageAnalysis,
  type PackageDocType,
  type PackageDocument,
  type PackageGateReason,
  type PackagePolicy,
} from './types';

/** Missing-document gate policy as data (AC-I19). `computeGate` is not touched. */
export const DEFAULT_PACKAGE_POLICY: PackagePolicy = Object.freeze(
  PackagePolicySchema.parse({
    missingDocGate: {
      sub_agreement: 'block',
      lpa: 'warn',
      ppm: 'warn',
      side_letter: 'warn',
      tax_form: 'warn',
    },
    warnOnlyWhenReferenced: ['ppm', 'side_letter', 'tax_form'],
  }),
) as PackagePolicy;

export interface CoverageGroupDef {
  id: CoverageGroupId;
  label: string;
  requires: PackageDocType[];
  recommends: PackageDocType[];
}

/** Coverage per check group (data; fixed order). */
export const COVERAGE_GROUP_DEFS: readonly CoverageGroupDef[] = Object.freeze([
  {
    id: 'structure_flow',
    label: 'Structure and flow',
    requires: ['sub_agreement'],
    recommends: [],
  },
  {
    id: 'internal_refs',
    label: 'Internal cross-references',
    requires: ['sub_agreement'],
    recommends: [],
  },
  {
    id: 'defined_terms',
    label: 'Defined terms',
    requires: ['sub_agreement'],
    recommends: ['lpa'],
  },
  {
    id: 'external_refs',
    label: 'External references',
    requires: ['sub_agreement'],
    recommends: [],
  },
  { id: 'investor_paths', label: 'Investor paths', requires: ['sub_agreement'], recommends: [] },
]);

export const DOC_TYPE_LABELS: Readonly<Record<PackageDocType, string>> = Object.freeze({
  sub_agreement: 'subscription agreement',
  lpa: 'LPA',
  ppm: 'PPM',
  tax_form: 'tax form',
  side_letter: 'side letter',
  other: 'other document',
});

const GATE_TEXT: Readonly<Record<string, string>> = Object.freeze({
  sub_agreement: 'No subscription agreement in this package, so there is nothing to digitize.',
  lpa: 'No LPA in this package, so terms defined there cannot be checked.',
  ppm: 'The subscription agreement refers to a PPM that is not in this package.',
  side_letter: 'The subscription agreement refers to a side letter that is not in this package.',
  tax_form: 'The subscription agreement refers to a tax form that is not in this package.',
});

/** A type is present only when a document of that type has readable text. */
export function hasReadable(docs: readonly PackageDocument[], type: PackageDocType): boolean {
  return docs.some((d) => d.type === type && !d.needsOcr);
}

/** Gate reasons for missing documents (pure; policy is data). */
export function packageGateReasons(
  analysis: Pick<PackageAnalysis, 'documents' | 'references'>,
  policy: PackagePolicy = DEFAULT_PACKAGE_POLICY,
): PackageGateReason[] {
  const out: PackageGateReason[] = [];
  for (const [type, level] of Object.entries(policy.missingDocGate) as Array<
    [Exclude<PackageDocType, 'other'>, 'block' | 'warn' | 'off']
  >) {
    if (level === 'off' || hasReadable(analysis.documents, type)) continue;
    if (
      policy.warnOnlyWhenReferenced.includes(type) &&
      !analysis.references.some((r) => r.targetFamily === type)
    )
      continue;
    out.push({ level, docType: type, text: GATE_TEXT[type]! });
  }
  const order = (r: PackageGateReason) => (r.level === 'block' ? 0 : 1);
  return out.sort((a, b) => order(a) - order(b));
}
