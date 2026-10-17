import { maskText, maskThenClip } from '../detectors/util';
import type { StructureView } from '../structure-view/build';
import type { OutlineDraft } from './schema';
import { OUTLINE_DISCLAIMER, OUTLINE_SCHEMA_ID, OUTLINE_TEXT_MAX } from './version';

export interface OutlineDraftOptions {
  /** sha256 hex of the source document. */
  docHash: string;
  source: 'html' | 'pdf' | 'docx' | 'ocr';
  pageCount?: number;
  /** 1-based page numbers whose OCR confidence was low. */
  ocrLowConfidencePages?: readonly number[];
  /** Short plain-language read notice (DOCX loss, OCR gaps). */
  notice?: string;
}

const t = (s: string): string => maskThenClip(s, OUTLINE_TEXT_MAX);

function confidenceNoteOf(opts: OutlineDraftOptions): string | undefined {
  const parts: string[] = [];
  const pages = (opts.ocrLowConfidencePages ?? []).filter((p) => Number.isInteger(p) && p > 0);
  if (pages.length)
    parts.push(
      `Low OCR confidence on page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}; check those pages against the scan.`,
    );
  if (opts.notice && opts.notice.trim()) parts.push(opts.notice.trim());
  return parts.length ? t(parts.join(' ')) : undefined;
}

/**
 * Pure projection of a masked StructureView into an outline draft (AC63). Key order is fixed by
 * construction; ids pass through unchanged; free text is masked then clipped to 300. Dropped:
 * quotes, block ids, finding ids, issue flags, option groups, gap rows.
 */
export function buildOutlineDraft(view: StructureView, opts: OutlineDraftOptions): OutlineDraft {
  const sections = view.sections.map((s) => ({
    id: s.id,
    number: t(s.number),
    title: t(s.title),
    depth: s.depth,
    restart: s.restart,
    refsIn: s.refsIn,
    refsOut: s.refsOut,
  }));
  const references: OutlineDraft['references'] = [
    ...view.crossrefs.map((r) => ({
      id: r.id,
      text: t(r.text),
      where: t(r.where),
      status: r.status,
      target: t(r.target),
      expected: r.expected === null ? null : t(r.expected),
      external: false as const,
    })),
    ...view.external.map((r) => ({
      id: r.id,
      text: t(r.text),
      where: t(r.where),
      source: t(r.source),
      external: true as const,
    })),
  ];
  const branches = view.conditions.map((c) => ({
    id: c.id,
    kind: c.kind,
    where: t(c.where),
    condition: t(c.condition),
    targets: c.target ? maskText(c.target).split(', ').map(t) : [],
    targetFound: c.targetFound,
    citation: t(c.text),
  }));
  const definedTerms = view.terms.map((r) => ({
    term: t(r.term),
    definedAt: t(r.definedAt),
    uses: r.uses,
    status: r.status,
    ...(r.note ? { note: t(r.note) } : {}),
  }));
  const investorPaths = view.investors.types.map((p) => ({
    type: t(p.type),
    label: t(p.label),
    sections: p.sections.map((x) => ({ number: t(x.number), title: t(x.title) })),
    skipped: p.skipped.map((x) => ({ number: t(x.number), title: t(x.title) })),
    questions: p.questions.map((q) => ({ section: t(q.section), text: t(q.text) })),
    reachesCompletion: p.reachesCompletion,
    uncertain: p.uncertain,
    gapCount: p.gaps.length,
  }));
  const confidenceNote = confidenceNoteOf(opts);
  return {
    schema: OUTLINE_SCHEMA_ID,
    disclaimer: OUTLINE_DISCLAIMER,
    document: {
      format: opts.source,
      contentHash: opts.docHash,
      ...(opts.pageCount !== undefined ? { pageCount: opts.pageCount } : {}),
    },
    sections,
    references,
    branches,
    definedTerms,
    investorPaths,
    ...(confidenceNote !== undefined ? { confidenceNote } : {}),
    counts: {
      sections: sections.length,
      references: references.length,
      branches: branches.length,
      definedTerms: definedTerms.length,
      investorPaths: investorPaths.length,
    },
  };
}
