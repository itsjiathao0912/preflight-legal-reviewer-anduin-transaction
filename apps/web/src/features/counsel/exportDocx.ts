import { maskAndClamp, type CounselSheet } from '@aduin/core';

/**
 * Counsel query sheet DOCX (Phase 08, D-1): title, firm / fund / version, then one numbered
 * question per UNANSWERED New/Accepted finding with its citation (location + masked quote),
 * interpretations A/B/C and a blank answer line for counsel. Recorded answers stay in the app.
 * `docx` is loaded lazily (its own chunk, E10): nothing imports it statically.
 */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORDING_MAX = 500;
/** Location and sheet meta fields are masked and clamped too (review fix F8). */
const LOCATION_MAX = 300;
const META_MAX = 200;

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Variance P04 (C1): owner names used in the per-owner DOCX title, body and filename. */
export const SHEET_OWNER_LABEL: Readonly<
  Record<NonNullable<CounselSheet['meta']['owner']>, string>
> = Object.freeze({ counsel: 'Counsel', gp: 'GP', fund_admin: 'Fund admin' });

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** `counsel-questions-<fund>.docx`; per owner `<owner>-questions-<fund>.docx`. */
export function docxFilename(meta: CounselSheet['meta']): string {
  const base = slug(meta.fund || meta.title || 'document');
  const who = meta.owner ? slug(SHEET_OWNER_LABEL[meta.owner]) : 'counsel';
  return `${who}-questions-${base || 'document'}.docx`;
}

/** Build the DOCX. `wording(findingKey)` is the question text (edited, AI or template draft). */
export async function buildCounselDocx(
  sheet: CounselSheet,
  wording: (findingKey: string) => string,
  generatedAt: Date = new Date(),
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const m = sheet.meta;
  const meta = {
    title: maskAndClamp(m.title || 'Counsel query sheet', META_MAX),
    firm: m.firm ? maskAndClamp(m.firm, META_MAX) : '',
    fund: m.fund ? maskAndClamp(m.fund, META_MAX) : '',
    version: m.version ? maskAndClamp(m.version, META_MAX) : '',
  };
  const facts = [
    meta.firm ? `Law firm: ${meta.firm}` : 'Law firm: not tagged',
    meta.fund ? `Fund: ${meta.fund}` : null,
    meta.version ? `Version: ${meta.version}` : null,
  ].filter((x): x is string => x !== null);
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(meta.title)] }),
    new Paragraph({ children: [new TextRun(facts.join(' · '))] }),
    new Paragraph({
      children: [
        new TextRun(
          `${sheet.questions.length} question${sheet.questions.length === 1 ? '' : 's'} for ${m.owner ? SHEET_OWNER_LABEL[m.owner] : 'counsel'} · prepared ${generatedAt.toISOString().slice(0, 10)}`,
        ),
      ],
    }),
  ];
  for (const q of sheet.questions) {
    const text = maskAndClamp(wording(q.findingKey) || 'Please confirm this clause.', WORDING_MAX);
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `${q.number}. ${text}`, bold: true })],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${maskAndClamp(q.location || 'Clause', LOCATION_MAX)} · "${q.quote}"`,
            italics: true,
          }),
        ],
      }),
      ...q.interpretations.map(
        (t, i) => new Paragraph({ children: [new TextRun(`${LETTERS[i] ?? '-'}. ${t}`)] }),
      ),
      new Paragraph({
        children: [new TextRun('Answer: ______   Note: ______   By / date: ______')],
      }),
    );
  }
  if (!sheet.questions.length) {
    children.push(new Paragraph({ children: [new TextRun('No unanswered questions.')] }));
  }
  const doc = new Document({
    creator: 'Sub-doc QA',
    title: meta.title,
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}
