import { computeCoverage } from './coverage';
import { buildDocumentRequests } from './request';
import { resolveReferences } from './resolve';
import { buildCrossDocTerms, definitionSources } from './terms';
import type {
  CrossDocDefinition,
  PackageAnalysis,
  PackageDocument,
  PackageFacts,
  PackageProblem,
  PrimaryFacts,
} from './types';

/** Can the package run? Every `low` row confirmed and exactly one `to_digitize` row. */
export function packageRunReadiness(docs: readonly PackageDocument[]): {
  ok: boolean;
  problems: PackageProblem[];
} {
  const problems: PackageProblem[] = [];
  for (const d of sortDocs(docs))
    if (d.confidence === 'low' && !d.confirmed)
      problems.push({ code: 'low_confidence_unconfirmed', docId: d.id });
  const n = docs.filter((d) => d.role === 'to_digitize').length;
  if (n === 0) problems.push({ code: 'no_to_digitize' });
  if (n > 1) problems.push({ code: 'multiple_to_digitize' });
  return { ok: problems.length === 0, problems };
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortDocs<T extends { id: string; name: string }>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => cmp(a.id, b.id) || cmp(a.name, b.name));
}

export interface AnalyzePackageInput {
  docs: readonly PackageDocument[];
  facts: readonly PackageFacts[];
  primary: PrimaryFacts | null;
  confirmedTargets?: Readonly<Record<string, string>>;
}

/** Pure package analysis (main-thread safe: no parser imports). Output is byte-stable. */
export function analyzePackage(input: AnalyzePackageInput): PackageAnalysis {
  const docs = sortDocs(input.docs);
  const facts = [...input.facts].sort(
    (a, b) => cmp(a.contentHash, b.contentHash) || cmp(a.name, b.name),
  );
  const primary = input.primary;
  const sources = new Set(definitionSources(docs).map((d) => d.id));
  const defs: CrossDocDefinition[] = facts
    .filter((f) => sources.has(f.contentHash))
    .flatMap((f) => f.definitions);
  const references = primary
    ? resolveReferences(
        primary.references,
        docs,
        facts,
        input.confirmedTargets ?? {},
        primary.docId,
      )
        .slice()
        .sort(
          (a, b) =>
            a.location.blockIndex - b.location.blockIndex ||
            a.location.start - b.location.start ||
            cmp(a.targetKey, b.targetKey),
        )
    : [];
  const terms = buildCrossDocTerms(primary, defs, sources.size > 0);
  return {
    schema: 'package-analysis.v1',
    documents: docs.map((d) => ({ ...d, titleLines: [...d.titleLines] })),
    references,
    terms,
    coverage: computeCoverage(docs, references, terms),
    requests: primary ? buildDocumentRequests(references, primary.docId) : [],
    dropped: primary?.dropped ?? 0,
  };
}
