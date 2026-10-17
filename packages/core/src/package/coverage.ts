import { COVERAGE_GROUP_DEFS, DOC_TYPE_LABELS } from './policy';
import type {
  CoverageGroup,
  CoverageStatus,
  CrossDocTerm,
  ExternalReference,
  PackageAnalysis,
  PackageDocType,
  PackageDocument,
} from './types';

const RANK: Record<CoverageStatus, number> = { full: 0, partial: 1, blocked: 2 };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Coverage per check group as data (AC-I17). Reason texts are fixed templates. */
export function computeCoverage(
  docs: readonly PackageDocument[],
  references: readonly ExternalReference[],
  terms: readonly CrossDocTerm[],
): CoverageGroup[] {
  const status = (t: PackageDocType): 'present' | 'ocr' | 'missing' => {
    const of = docs.filter((d) => d.type === t);
    if (of.some((d) => !d.needsOcr)) return 'present';
    return of.length ? 'ocr' : 'missing';
  };
  const unverified = terms.filter((t) => t.status === 'unverified').length;
  const notIn = references.filter((r) => r.resolution === 'not_in_package').length;
  const unclear = references.filter((r) => r.resolution === 'unclear').length;
  const ocrDocs = docs.filter((d) => d.needsOcr).length;
  return COVERAGE_GROUP_DEFS.map((def) => {
    const g: CoverageGroup = {
      id: def.id,
      label: def.label,
      status: 'full',
      missingTypes: [],
      reasons: [],
    };
    const bump = (s: CoverageStatus) => {
      if (RANK[s] > RANK[g.status]) g.status = s;
    };
    for (const t of def.requires) {
      const st = status(t);
      if (st === 'present') continue;
      bump('blocked');
      g.missingTypes.push(t);
      g.reasons.push(
        st === 'ocr'
          ? `${DOC_TYPE_LABELS[t]} has no readable text (needs OCR)`
          : `no ${DOC_TYPE_LABELS[t]}`,
      );
    }
    for (const t of def.recommends) {
      const st = status(t);
      if (st === 'present') continue;
      bump('partial');
      g.missingTypes.push(t);
      g.reasons.push(st === 'ocr' ? 'needs OCR' : `no ${DOC_TYPE_LABELS[t]}`);
    }
    if (def.id === 'defined_terms' && unverified) {
      bump('partial');
      g.reasons.push(plural(unverified, 'term unverified', 'terms unverified'));
    }
    if (def.id === 'external_refs') {
      if (notIn) {
        bump('partial');
        g.reasons.push(
          plural(notIn, 'reference not in the package', 'references not in the package'),
        );
      }
      if (unclear) {
        bump('partial');
        g.reasons.push(plural(unclear, 'reference to confirm', 'references to confirm'));
      }
      if (ocrDocs) {
        bump('partial');
        g.reasons.push('needs OCR');
      }
    }
    return g;
  });
}

/** `Coverage: full` or `Coverage: <worst> - <reasons, deduplicated, at most 3>, +N more`. */
export function coverageLineText(analysis: Pick<PackageAnalysis, 'coverage'>): string {
  let worst: CoverageStatus = 'full';
  const reasons: string[] = [];
  for (const g of analysis.coverage) {
    if (RANK[g.status] > RANK[worst]) worst = g.status;
    for (const r of g.reasons) if (!reasons.includes(r)) reasons.push(r);
  }
  if (worst === 'full') return 'Coverage: full';
  const shown = reasons.slice(0, 3).join(', ');
  const more = reasons.length > 3 ? `, +${reasons.length - 3} more` : '';
  return `Coverage: ${worst} - ${shown}${more}`;
}
