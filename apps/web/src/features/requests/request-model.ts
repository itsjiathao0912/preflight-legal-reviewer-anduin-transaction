import {
  maskAndClamp,
  maskQuote,
  type DocumentRequest,
  type ExternalReference,
  type Owner,
  type TargetFamily,
} from '@aduin/core';
import { snipQuote } from '../counsel/questions-table';
import { itemNeedsAnswer, OWNER_LABEL, type QuestionItem } from '../variance/owner-groups';

/**
 * Requests (22-10-26): one request per owner (Counsel, GP, Fund admin). Pure helpers for the
 * Requests page rows and the Request drawer: status derivation, the GP documents grouped by kind,
 * the default header fields and the plain-text letter behind "Copy text". Browser-only state (To,
 * Needed by, Sent) lives in `request-store.ts`.
 */
export type RequestStatus = 'none' | 'draft' | 'sent' | 'partly' | 'answered';

export const STATUS_LABEL: Readonly<Record<RequestStatus, string>> = Object.freeze({
  none: 'Nothing to ask',
  draft: 'Draft',
  sent: 'Sent',
  partly: 'Partly answered',
  answered: 'Answered',
});

/** Browser-only fields of one owner's request. */
export interface RequestMeta {
  to?: string;
  /** yyyy-mm-dd (local). */
  neededBy?: string;
  /** Epoch ms when the request was sent (Mark as sent, or Share link / export for counsel). */
  sentAt?: number;
}

export interface RequestCounts {
  /** Questions for this owner. */
  total: number;
  /** Questions with a clear answer. */
  answered: number;
  /** Missing documents still to send (GP only). */
  documents: number;
}

/** Items still waiting: open questions plus missing documents. */
export const waitingOf = (c: RequestCounts): number => c.total - c.answered + c.documents;

/**
 * Draft -> Sent -> Partly answered -> Answered. Answers move the status even before the request is
 * marked as sent (counsel can answer on the share link). Documents count as open items: the GP
 * request is Answered only once every question is answered and no document is missing.
 */
export function requestStatus(c: RequestCounts, meta: RequestMeta | undefined): RequestStatus {
  if (c.total + c.documents === 0) return 'none';
  if (waitingOf(c) === 0) return 'answered';
  if (c.answered > 0) return 'partly';
  return meta?.sentAt ? 'sent' : 'draft';
}

const DAY = 86_400_000;

export function isoDay(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Needed by: the stored date, else 7 days after sending (or after today while a draft). */
export function neededByOf(meta: RequestMeta | undefined, now: number = Date.now()): string {
  if (meta?.neededBy && /^\d{4}-\d{2}-\d{2}$/.test(meta.neededBy)) return meta.neededBy;
  return isoDay((meta?.sentAt ?? now) + 7 * DAY);
}

/** Overdue: Needed by is before today and the request is not Answered. */
export function isOverdue(
  status: RequestStatus,
  neededBy: string,
  now: number = Date.now(),
): boolean {
  if (status === 'none' || status === 'answered') return false;
  return neededBy < isoDay(now);
}

/** "29 Oct 2026" for a yyyy-mm-dd day. */
export function fmtDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Default "To": Counsel (with the firm when tagged), the fund's GP, the fund administrator. */
export function defaultTo(owner: Owner, doc: { firmName?: string; fund?: string } | null): string {
  if (owner === 'counsel') return doc?.firmName ? `Counsel, ${doc.firmName}` : 'Counsel';
  if (owner === 'gp') return doc?.fund ? `GP of ${doc.fund}` : 'GP';
  return 'Fund administrator';
}

/** "Fund III · Subscription Agreement · v1" (empty parts dropped, duplicates once). */
export function aboutLine(doc: { fund?: string; name?: string; version?: string } | null): string {
  const parts = [doc?.fund, doc?.name, doc?.version].map((x) => (x ?? '').trim()).filter(Boolean);
  return [...new Set(parts)].join(' · ') || 'Document';
}

export function countsFor(
  owner: Owner,
  items: readonly QuestionItem[],
  documents: number,
): RequestCounts {
  const mine = items.filter((q) => q.owner === owner);
  return {
    total: mine.length,
    answered: mine.filter((q) => !itemNeedsAnswer(q)).length,
    documents: owner === 'gp' ? documents : 0,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* GP documents                                                                                */

export const FAMILY_ORDER: readonly TargetFamily[] = [
  'annex',
  'side_letter',
  'tax_form',
  'lpa',
  'ppm',
];

export const FAMILY_LABEL: Readonly<Record<TargetFamily, string>> = Object.freeze({
  annex: 'Annex',
  side_letter: 'Side letter',
  tax_form: 'Tax forms',
  lpa: 'Partnership agreement',
  ppm: 'Offering memorandum',
});

export interface RequestDoc {
  key: string;
  label: string;
  /** One masked sentence of the first reference, starting at a word or sentence boundary. */
  quote: string;
  /** "Section 9.1" / "Sections 6.4, 14.3" (empty when unknown). */
  location: string;
}

export interface RequestDocGroup {
  family: TargetFamily;
  label: string;
  docs: RequestDoc[];
}

/**
 * One sentence of a quote: the snippet fix first (a quote cut mid-word loses its partial word), then
 * a quote that starts mid-sentence starts at the next full sentence when one follows.
 */
export function sentenceQuote(raw: string): string {
  const t = snipQuote(maskQuote(raw));
  if (!t.startsWith('…')) return t;
  const m = /[.;:]\s+(?=[A-Z("“])/.exec(t);
  if (!m) return t;
  const rest = t.slice(m.index + m[0].length).trim();
  return rest.length >= 30 ? rest : t;
}

function sectionOf(r: ExternalReference): string {
  const p = r.location.sectionPath;
  return (p[p.length - 1] ?? '').trim();
}

/** "Section 9.1", "Sections 6.4, 14.3" from the referencing places. */
export function locationLine(sections: readonly string[]): string {
  const uniq = [...new Set(sections.filter(Boolean))];
  if (!uniq.length) return '';
  const bare = uniq.map((s) => s.replace(/^sections?\s+/i, ''));
  return `${uniq.length === 1 ? 'Section' : 'Sections'} ${bare.join(', ')}`;
}

/** Missing documents grouped by kind (fixed order), each with one sentence and its location. */
export function groupDocuments(
  requests: readonly DocumentRequest[],
  references: readonly ExternalReference[] = [],
): RequestDocGroup[] {
  const groups: RequestDocGroup[] = [];
  for (const family of FAMILY_ORDER) {
    const docs = requests
      .filter((r) => r.targetFamily === family)
      .map((r) => ({
        key: r.targetKey,
        label: maskAndClamp(r.label, 200),
        quote: sentenceQuote(r.quote),
        location: locationLine(
          references.filter((x) => x.targetKey === r.targetKey).map(sectionOf),
        ),
      }));
    if (docs.length) groups.push({ family, label: FAMILY_LABEL[family], docs });
  }
  return groups;
}

/* ------------------------------------------------------------------------------------------ */
/* Copy text                                                                                   */

export interface LetterInput {
  owner: Owner;
  to: string;
  about: string;
  neededBy: string;
  questions: readonly { text: string; quote: string; loc: string; answer: string | null }[];
  groups: readonly RequestDocGroup[];
}

/** Plain-text request for e-mail: header, open questions, documents to send. */
export function requestText(x: LetterInput): string {
  const lines = [`To: ${x.to}`, `About: ${x.about}`, `Needed by: ${fmtDay(x.neededBy)}`, ''];
  const open = x.questions.filter((q) => !q.answer);
  if (open.length) {
    lines.push(`Questions for ${OWNER_LABEL[x.owner]}`);
    open.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.text}`);
      if (q.quote) lines.push(`   "${q.quote}" (${q.loc})`);
    });
    lines.push('');
  }
  const docs = x.groups.flatMap((g) => g.docs);
  if (docs.length) {
    lines.push(
      'Documents to send',
      'The subscription agreement refers to these documents, but they are not in the package we received.',
    );
    let n = 0;
    for (const g of x.groups) {
      lines.push(`${g.label} (${g.docs.length})`);
      for (const d of g.docs) {
        n++;
        lines.push(`${n}. ${d.label}${d.location ? ` · ${d.location}` : ''}`);
        if (d.quote) lines.push(`   "${d.quote}"`);
      }
    }
  }
  return lines.join('\n').trim();
}
