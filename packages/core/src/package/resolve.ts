import { resolvedPartOf } from './parts';
import { referenceId } from './references';
import type {
  ExternalReference,
  PackageDocument,
  PackageFacts,
  RawReference,
  TargetFamily,
} from './types';

/** Synonyms per document family (data). All of these mean the same document. */
export const DOC_SYNONYMS: Readonly<Record<Exclude<TargetFamily, 'annex'>, readonly string[]>> =
  Object.freeze({
    lpa: [
      'limited partnership agreement',
      'partnership agreement',
      'lp agreement',
      'lpa',
      'fund agreement',
      'limited liability company agreement',
      'llc agreement',
      'operating agreement',
    ],
    ppm: ['private placement memorandum', 'offering memorandum', 'memorandum', 'prospectus', 'ppm'],
    side_letter: ['side letter', 'side letters'],
    tax_form: [
      'form w-8ben',
      'form w-8ben-e',
      'form w-9',
      'form w-8imy',
      'form w-8exp',
      'form w-8eci',
    ],
  });

/** Family of a free-text document label via DOC_SYNONYMS, or null. */
export function familyOfLabel(label: string): Exclude<TargetFamily, 'annex'> | null {
  const l = label.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const [fam, list] of Object.entries(DOC_SYNONYMS))
    if (list.includes(l)) return fam as Exclude<TargetFamily, 'annex'>;
  return null;
}

/** Literal analyst choice "none": confirmed as not in the package. */
export const CONFIRMED_NONE = 'none';

/** Escape regex metacharacters so a label is matched literally. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function carriesLabel(d: PackageDocument, f: PackageFacts | undefined, label: string): boolean {
  const re = new RegExp(
    `(?:^|[^A-Za-z0-9])${label.split(/\s+/).map(escapeRegExp).join('[\\s_-]{1,3}')}(?![A-Za-z0-9])`,
    'i',
  );
  return (
    re.test(d.name) ||
    d.titleLines.some((t) => re.test(t)) ||
    (f?.headings ?? []).some((h) => re.test(h))
  );
}

/**
 * Resolve references against the package (AC-I12): exactly one confident candidate gives
 * `resolved`; none gives `not_in_package`; two or more, or one low unconfirmed candidate, gives
 * `unclear` (never guessed). `confirmedTargets[targetKey]` (doc id or "none") overrides.
 */
export function resolveReferences(
  raw: readonly RawReference[],
  docs: readonly PackageDocument[],
  facts: readonly PackageFacts[],
  confirmedTargets: Readonly<Record<string, string>>,
  primaryId: string,
): ExternalReference[] {
  const factsById = new Map(facts.map((f) => [f.contentHash, f]));
  const others = docs.filter((d) => d.id !== primaryId);
  const withPart = (e: ExternalReference): ExternalReference => {
    if (e.resolution !== 'resolved' || !e.resolvedDocId) return e;
    const part = resolvedPartOf(e, factsById.get(e.resolvedDocId));
    return part ? { ...e, resolvedPart: part } : e;
  };
  return raw.map((r) => withPart(resolveOne(r)));
  function resolveOne(r: RawReference): ExternalReference {
    const base = { ...r, id: referenceId(primaryId, r), confirmedByAnalyst: false };
    const confirmed = confirmedTargets[r.targetKey];
    if (confirmed !== undefined) {
      if (confirmed !== CONFIRMED_NONE && others.some((d) => d.id === confirmed))
        return {
          ...base,
          resolution: 'resolved',
          resolvedDocId: confirmed,
          confirmedByAnalyst: true,
        };
      return { ...base, resolution: 'not_in_package', confirmedByAnalyst: true };
    }
    let cands: PackageDocument[];
    if (r.targetFamily === 'annex')
      cands = others.filter((d) => carriesLabel(d, factsById.get(d.id), r.targetLabel));
    else if (r.targetFamily === 'tax_form')
      cands = others.filter(
        (d) => d.type === 'tax_form' && carriesLabel(d, factsById.get(d.id), r.targetLabel),
      );
    else cands = others.filter((d) => d.type === r.targetFamily);
    if (cands.length === 0) return { ...base, resolution: 'not_in_package' };
    if (cands.length === 1 && (cands[0]!.confidence === 'high' || cands[0]!.confirmed))
      return { ...base, resolution: 'resolved', resolvedDocId: cands[0]!.id };
    return { ...base, resolution: 'unclear' };
  }
}
