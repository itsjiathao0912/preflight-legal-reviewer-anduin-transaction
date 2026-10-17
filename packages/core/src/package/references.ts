import { sha256Hex } from '../model/hash';
import type { Block } from '../model/types';
import { blockTextOf, isVerbatim, locationOf, sentenceWindow } from './quote';
import type { RawReference, TargetFamily } from './types';

/**
 * External references (AC-I10/I11). Pattern data, linear-time. A named document (family 3) is
 * the reference target; the definitional (family 1) and governing (family 2) phrases are kept as
 * data for consumers that label the context. Exclusions: self-reference ("this ..."), and an
 * Annex/Schedule/Exhibit/Appendix whose label is a heading or scope label of the same document.
 */
export const DEFINITIONAL_PHRASES: readonly string[] = Object.freeze([
  'as defined in the',
  'have the meanings given to them in the',
  'has the meaning given to it in the',
  'meanings ascribed to them in the',
]);
export const GOVERNING_PHRASES: readonly string[] = Object.freeze([
  'pursuant to',
  'in accordance with',
  'subject to the terms of',
  'as set forth in',
]);

export interface NamedDocPattern {
  label: string;
  family: Exclude<TargetFamily, 'annex'>;
}

/** Longest first, so "Limited Partnership Agreement" wins over "Partnership Agreement". */
export const NAMED_DOCUMENTS: readonly NamedDocPattern[] = Object.freeze([
  { label: 'Amended and Restated Limited Partnership Agreement', family: 'lpa' },
  { label: 'Limited Liability Company Agreement', family: 'lpa' },
  { label: 'Limited Partnership Agreement', family: 'lpa' },
  { label: 'Private Placement Memorandum', family: 'ppm' },
  { label: 'Partnership Agreement', family: 'lpa' },
  { label: 'Offering Memorandum', family: 'ppm' },
  { label: 'Operating Agreement', family: 'lpa' },
  { label: 'Fund Agreement', family: 'lpa' },
  { label: 'LLC Agreement', family: 'lpa' },
  { label: 'LP Agreement', family: 'lpa' },
  { label: 'Side Letters', family: 'side_letter' },
  { label: 'Side Letter', family: 'side_letter' },
  { label: 'Memorandum', family: 'ppm' },
  { label: 'Prospectus', family: 'ppm' },
  { label: 'PPM', family: 'ppm' },
]);

export const TAX_FORM_RE = /\bForms?\s{1,2}(W-8BEN-E|W-8BEN|W-8IMY|W-8EXP|W-8ECI|W-9)\b/g;
export const ANNEX_REF_RE =
  /\b(Annex|Schedule|Exhibit|Appendix)\s{1,2}([A-Z]|\d{1,2})(?![A-Za-z0-9-])/g;

const NAMED_RE = new RegExp(
  `\\b(${NAMED_DOCUMENTS.map((d) => d.label.replace(/ /g, '\\s{1,2}')).join('|')})\\b`,
  'g',
);
/** Exported for redos and tests. */
export const NAMED_DOCUMENTS_RE = NAMED_RE;

export interface ReferenceContext {
  docId: string;
  /** Section, annex, schedule and appendix labels of this document ("Annex A", "Section 4"). */
  scopeLabels: readonly string[];
  /** Test seam (AC-I13): replace the quote builder to inject a corrupt quote. */
  quoteOf?: (
    text: string,
    start: number,
    end: number,
  ) => { quote: string; start: number; end: number };
}

export function targetKeyOf(family: TargetFamily, label: string): string {
  if (family === 'annex' || family === 'tax_form')
    return `${family}:${label.toLowerCase().replace(/\s+/g, ' ')}`;
  return family;
}

export function referenceId(docId: string, r: RawReference): string {
  return sha256Hex(
    `${docId}|${r.location.blockIndex}|${r.location.start}|${r.targetKey}|${r.targetLabel}`,
  ).slice(0, 16);
}

/** Raw references of one document, in document order, plus the count of dropped quotes. */
export function extractExternalReferences(
  blocks: readonly Block[],
  ctx: ReferenceContext,
): { references: RawReference[]; dropped: number } {
  const internal = new Set(ctx.scopeLabels.map((l) => l.toLowerCase()));
  const quoteOf = ctx.quoteOf ?? sentenceWindow;
  const out: RawReference[] = [];
  let dropped = 0;
  blocks.forEach((b, bi) => {
    const text = blockTextOf(b);
    const hits: Array<{ at: number; end: number; label: string; family: TargetFamily }> = [];
    for (const m of text.matchAll(NAMED_RE)) {
      const before = text.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
      if (/\bthis\s$/.test(before)) continue;
      const label = m[1]!.replace(/\s+/g, ' ');
      const d = NAMED_DOCUMENTS.find((x) => x.label === label)!;
      hits.push({ at: m.index, end: m.index + m[0].length, label: d.label, family: d.family });
    }
    for (const m of text.matchAll(TAX_FORM_RE)) {
      hits.push({
        at: m.index,
        end: m.index + m[0].length,
        label: `Form ${m[1]}`,
        family: 'tax_form',
      });
    }
    for (const m of text.matchAll(ANNEX_REF_RE)) {
      const label = `${m[1]} ${m[2]}`;
      if (internal.has(label.toLowerCase())) continue;
      const before = text.slice(Math.max(0, m.index - 6), m.index).toLowerCase();
      if (/\bthis\s$/.test(before)) continue;
      hits.push({ at: m.index, end: m.index + m[0].length, label, family: 'annex' });
    }
    hits.sort((a, c) => a.at - c.at);
    for (const h of hits) {
      const w = quoteOf(text, h.at, h.end);
      if (!isVerbatim(text, w.quote)) {
        dropped++;
        continue;
      }
      out.push({
        quote: w.quote,
        location: locationOf(b, bi, h.at, h.end),
        targetLabel: h.label,
        targetKey: targetKeyOf(h.family, h.label),
        targetFamily: h.family,
      });
    }
  });
  return { references: out, dropped };
}
