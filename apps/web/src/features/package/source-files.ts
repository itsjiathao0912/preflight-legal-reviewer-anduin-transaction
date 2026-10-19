import type { FindingView } from '../../engine/types';
import type { PackageDocView, PackageView } from './contract';

/** One package file a check relied on, and where to open it (block index in that file). */
export interface SourceFileEntry {
  doc: PackageDocView;
  blockIndex: number | null;
}

export interface SourceFiles {
  files: SourceFileEntry[];
  /** "none in the package (no LPA), terms not checked". */
  missing: string[];
}

export const NO_DEFINITION_FILE = 'none in the package (no LPA), terms not checked';

type FindingLike = Pick<FindingView, 'issue_class' | 'anchor'> & {
  detail: { facts: Record<string, unknown> };
};

const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean => a0 < b1 && b0 < a1;

/**
 * Source File row (Findings Details): the package files a check relied on. Defined-term checks use
 * the reference LPA / PPM (the definition sources); a finding over an external reference uses the
 * file it resolved to. Null when the check uses no other package file, or there is no package.
 */
export function sourceFilesFor(
  f: FindingLike,
  view: PackageView | null,
  blockIndex: number | null,
): SourceFiles | null {
  if (!view) return null;
  const files = new Map<string, SourceFileEntry>();
  const missing: string[] = [];
  const add = (doc: PackageDocView, at: number | null) => {
    const hit = files.get(doc.id);
    if (!hit) files.set(doc.id, { doc, blockIndex: at });
    else if (hit.blockIndex === null) hit.blockIndex = at;
  };
  if (f.issue_class === 'defined_term_issue') {
    const used = f.detail.facts['used_term'];
    const term =
      typeof used === 'string'
        ? view.terms.find((t) => t.term.toLowerCase() === used.toLowerCase())
        : undefined;
    const sources = view.documents.filter(
      (d) =>
        !d.isPrimary &&
        d.role === 'reference' &&
        (d.type === 'lpa' || d.type === 'ppm') &&
        !d.needsOcr,
    );
    if (sources.length === 0) missing.push(NO_DEFINITION_FILE);
    for (const d of sources)
      add(d, term?.definingDocId === d.id ? (term.definitionLocation?.blockIndex ?? null) : null);
  }
  if (blockIndex !== null) {
    for (const r of view.references) {
      if (r.location.blockIndex !== blockIndex) continue;
      if (!overlaps(r.location.start, r.location.end, f.anchor.offsetStart, f.anchor.offsetEnd))
        continue;
      const doc =
        r.resolution === 'resolved'
          ? view.documents.find((d) => d.id === r.resolvedDocId && !d.isPrimary)
          : undefined;
      if (doc) add(doc, r.resolvedPart?.blockIndex ?? null);
      else if (r.resolution === 'not_in_package') {
        const line = `none in the package (no ${r.targetLabel}), reference not checked`;
        if (!missing.includes(line)) missing.push(line);
      }
    }
  }
  if (files.size === 0 && missing.length === 0) return null;
  return { files: [...files.values()], missing };
}
