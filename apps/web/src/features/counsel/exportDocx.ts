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

/** One answered question of the final (ready to digitize) DOCX. */
export interface FinalQuestion {
  number: number;
  text: string;
  location: string;
  /** Masked quote (shown in quotes). */
  quote: string;
  interpretations: readonly string[];
  /** Recorded answer: A/B/C/unclear, or null when none was recorded. */
  option: 'A' | 'B' | 'C' | 'unclear' | null;
  note?: string | undefined;
  by?: string | undefined;
  at?: number | undefined;
}

/** `final-answers-<fund>.docx` */
export function finalDocxFilename(meta: CounselSheet['meta']): string {
  const base = slug(meta.fund || meta.title || 'document');
  return `final-answers-${base || 'document'}.docx`;
}

/**
 * Final DOCX handed to digitization (counsel share link, "Mark ready to digitize"): every question
 * with the recorded answer (option + the chosen reading), counsel's note and who answered when.
 * Every free-text field is masked and clamped like the query sheet.
 */
export async function buildFinalDocx(
  meta: CounselSheet['meta'],
  questions: readonly FinalQuestion[],
  readyAt: Date = new Date(),
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const title = maskAndClamp(meta.title || 'Counsel answers', META_MAX);
  const facts = [
    meta.firm ? `Law firm: ${maskAndClamp(meta.firm, META_MAX)}` : 'Law firm: not tagged',
    meta.fund ? `Fund: ${maskAndClamp(meta.fund, META_MAX)}` : null,
    meta.version ? `Version: ${maskAndClamp(meta.version, META_MAX)}` : null,
  ].filter((x): x is string => x !== null);
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(title)] }),
    new Paragraph({ children: [new TextRun(facts.join(' · '))] }),
    new Paragraph({
      children: [
        new TextRun(
          `Ready to digitize · ${questions.length} question${questions.length === 1 ? '' : 's'} answered · ${readyAt.toISOString().slice(0, 10)}`,
        ),
      ],
    }),
  ];
  for (const q of questions) {
    const i = q.option && q.option !== 'unclear' ? LETTERS.indexOf(q.option) : -1;
    const reading = i >= 0 ? q.interpretations[i] : undefined;
    const answer =
      q.option === null
        ? 'No answer recorded'
        : q.option === 'unclear'
          ? 'Unclear'
          : `Option ${q.option}${reading ? `: ${maskAndClamp(reading, WORDING_MAX)}` : ''}`;
    const by = q.by ? maskAndClamp(q.by, 120) : 'not recorded';
    const when = q.at ? ` on ${new Date(q.at).toISOString().slice(0, 10)}` : '';
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: `${q.number}. ${maskAndClamp(q.text || 'Please confirm this clause.', WORDING_MAX)}`,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${maskAndClamp(q.location || 'Clause', LOCATION_MAX)} · "${maskAndClamp(q.quote, WORDING_MAX)}"`,
            italics: true,
          }),
        ],
      }),
      new Paragraph({ children: [new TextRun(`Answer: ${answer}`)] }),
      ...(q.note
        ? [new Paragraph({ children: [new TextRun(`Note: ${maskAndClamp(q.note, 1000)}`)] })]
        : []),
      new Paragraph({ children: [new TextRun(`Answered by: ${by}${when}`)] }),
    );
  }
  if (!questions.length) {
    children.push(new Paragraph({ children: [new TextRun('No questions on this sheet.')] }));
  }
  const doc = new Document({ creator: 'Sub-doc QA', title, sections: [{ children }] });
  return Packer.toBlob(doc);
}
