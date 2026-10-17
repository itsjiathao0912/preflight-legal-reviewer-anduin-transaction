import { maskAndClamp, type DocumentRequest } from '@aduin/core';

/**
 * GP missing-documents request DOCX (intake Phase 3c, AC-I20): one numbered item per missing
 * document with its masked first reference. Core stores quotes UNMASKED, so every string is masked
 * here. Items are defensively deduplicated by `targetKey`, then by lower-cased label (E6).
 * `docx` is loaded lazily like `exportDocx.ts`. Nothing is written to memory, Dexie or the server.
 */
export interface RequestDocxMeta {
  firm: string | null;
  fund: string | null;
  version: string | null;
}

const META_MAX = 200;
const LABEL_MAX = 200;
const QUOTE_MAX = 300;

export function requestDocxFilename(meta: RequestDocxMeta): string {
  // masked fund: digits of a sensitive span (account numbers) never reach the file name
  const base = (meta.fund ? maskAndClamp(meta.fund, META_MAX) : 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `missing-documents-${base || 'document'}.docx`;
}

/** Dedupe by targetKey, then by lower-cased trimmed label; first quote kept, counts summed. */
export function dedupeRequests(requests: readonly DocumentRequest[]): DocumentRequest[] {
  const byKey = new Map<string, DocumentRequest>();
  const byLabel = new Map<string, DocumentRequest>();
  const out: DocumentRequest[] = [];
  for (const r of requests) {
    const label = r.label.trim().toLowerCase();
    const hit = byKey.get(r.targetKey) ?? byLabel.get(label);
    if (hit) {
      hit.count += r.count;
      continue;
    }
    const copy = { ...r };
    byKey.set(r.targetKey, copy);
    byLabel.set(label, copy);
    out.push(copy);
  }
  return out;
}

export async function buildRequestDocx(
  meta: RequestDocxMeta,
  requests: readonly DocumentRequest[],
  generatedAt: Date = new Date(),
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const fund = meta.fund ? maskAndClamp(meta.fund, META_MAX) : '';
  const firm = meta.firm ? maskAndClamp(meta.firm, META_MAX) : '';
  const version = meta.version ? maskAndClamp(meta.version, META_MAX) : '';
  const title = `Missing documents request · ${fund || 'Document'}`;
  const items = dedupeRequests(requests);
  const facts = [
    firm ? `Law firm: ${firm}` : 'Law firm: not tagged',
    fund ? `Fund: ${fund}` : null,
    version ? `Version: ${version}` : null,
  ].filter((x): x is string => x !== null);
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun(facts.join(' · '))] }),
    new Paragraph({
      children: [
        new TextRun(
          `${items.length} document${items.length === 1 ? '' : 's'} needed · prepared ${generatedAt.toISOString().slice(0, 10)}`,
        ),
      ],
    }),
  ];
  items.forEach((r, i) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({ text: `${i + 1}. ${maskAndClamp(r.label, LABEL_MAX)}`, bold: true }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Referenced ${r.count} time${r.count === 1 ? '' : 's'}. First reference: "${maskAndClamp(r.quote, QUOTE_MAX)}"`,
            italics: true,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun('Why we need it: The subscription agreement refers to this document.'),
        ],
      }),
      new Paragraph({ children: [new TextRun('Status / expected date: ______')] }),
    );
  });
  if (!items.length) {
    children.push(new Paragraph({ children: [new TextRun('No missing documents.')] }));
  }
  const doc = new Document({ creator: 'Sub-doc QA', title, sections: [{ children }] });
  return Packer.toBlob(doc);
}
