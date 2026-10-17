import type {
  DetectInput,
  DetectResult,
  DocTypeSuggester,
  PackageConfidence,
  PackageDocType,
  PackageDocument,
} from './types';

export type { DocTypeSuggester };

/**
 * Rule-based document type detection (AC-I4/I5). Rules are data: title phrases score 3, file-name
 * tokens 2, body phrases in the first 1500 characters 1 each (max 3). `high` needs a top score
 * of at least 3 and a margin of at least 2 over the runner-up; a tie is never `high`.
 * Reasons are fixed templates that quote rule phrases only, never document text.
 */
export interface DetectRule {
  type: PackageDocType;
  title: readonly string[];
  fileTokens: readonly string[];
  body: readonly string[];
}

export const DETECT_RULES: readonly DetectRule[] = Object.freeze([
  {
    type: 'sub_agreement',
    title: [
      'subscription agreement',
      'subscription booklet',
      'subscription documents',
      'subscription document',
      'subscription application',
    ],
    fileTokens: ['subscription', 'sub'],
    body: ['subscriber', 'capital commitment', 'accredited investor'],
  },
  {
    type: 'lpa',
    title: [
      'amended and restated limited partnership agreement',
      'limited partnership agreement',
      'agreement of limited partnership',
      'limited liability company agreement',
      'operating agreement',
    ],
    fileTokens: ['lpa', 'lp-agreement', 'partnership-agreement', 'llc-agreement'],
    body: ['limited partners', 'general partner', 'capital account'],
  },
  {
    type: 'ppm',
    title: [
      'private placement memorandum',
      'offering memorandum',
      'confidential memorandum',
      'prospectus',
    ],
    fileTokens: ['ppm', 'memorandum', 'prospectus'],
    body: ['summary of terms', 'risk factors', 'offering'],
  },
  {
    type: 'tax_form',
    title: [
      'form w-8ben-e',
      'form w-8ben',
      'form w-8imy',
      'form w-9',
      'tax form selection guide',
      'tax forms guide',
    ],
    fileTokens: ['w-8', 'w8', 'w-9', 'w9', 'tax-forms', 'tax-form'],
    body: ['internal revenue service', 'taxpayer identification number'],
  },
  {
    type: 'side_letter',
    title: ['side letter'],
    fileTokens: ['side-letter'],
    body: ['side letter', 'most favored nation'],
  },
  {
    // correspondence and supporting checklists: typed `other` so they never pose as agreements
    type: 'other',
    title: [
      'email',
      'investor questionnaire',
      'aml/kyc',
      'aml and kyc',
      'kyc checklist',
      'onboarding checklist',
    ],
    fileTokens: ['email', 'questionnaire', 'kyc', 'checklist'],
    body: [],
  },
]);

/** A title line is short and not a sentence (prose lines never carry title points). */
export const TITLE_LINE_MAX = 100;

/** SEC cover boilerplate (S-11 registration statements): maps to `ppm` at `low`. */
export const SEC_COVER_PHRASES: readonly string[] = Object.freeze([
  'registration statement',
  'form s-11',
]);
export const BASELINE_NAME_HINTS: readonly string[] = Object.freeze([
  'prior',
  'previous',
  'baseline',
]);
export const TYPE_ORDER: readonly PackageDocType[] = Object.freeze([
  'sub_agreement',
  'lpa',
  'ppm',
  'tax_form',
  'side_letter',
  'other',
]);

export const NO_MATCH_REASON = 'No title, file name or opening text matched a known document type.';
export const TWO_SUBS_REASON =
  'Two subscription agreements in this package; choose which one to digitize.';

export function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,5}$/, '')
    .replace(/[\s_.]+/g, '-');
}

function hasToken(fileName: string, token: string): boolean {
  const parts = fileName.split('-');
  if (!token.includes('-')) return parts.includes(token);
  return `-${fileName}-`.includes(`-${token}-`);
}

interface Score {
  type: PackageDocType;
  score: number;
  titleLine: number;
  titleOffset: number;
  title?: string;
  file?: string;
  body?: string;
}

function lower(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ');
}

/** Index of the document title: the first title-like line holding any rule's title phrase. */
function titleLineIndex(titles: string[]): number {
  for (let i = 0; i < titles.length; i++)
    if (DETECT_RULES.some((r) => r.title.some((p) => titles[i]!.includes(p)))) return i;
  return -1;
}

function scoreRule(
  rule: DetectRule,
  fileName: string,
  titles: string[],
  titleIdx: number,
  head: string,
): Score {
  const s: Score = { type: rule.type, score: 0, titleLine: Infinity, titleOffset: Infinity };
  // title points only on the document title line; lowest offset wins (longer phrases first)
  if (titleIdx >= 0) {
    for (const phrase of rule.title) {
      const at = titles[titleIdx]!.indexOf(phrase);
      if (at >= 0 && at < s.titleOffset) {
        s.titleLine = titleIdx;
        s.titleOffset = at;
        s.title = phrase;
      }
    }
  }
  if (s.title) s.score += 3;
  const file = rule.fileTokens.find((t) => hasToken(fileName, t));
  if (file) {
    s.score += 2;
    s.file = file;
  }
  let body = 0;
  for (const phrase of rule.body) {
    if (body >= 3) break;
    if (head.includes(phrase)) {
      body++;
      s.body ??= phrase;
    }
  }
  s.score += body;
  return s;
}

function compare(a: Score, b: Score): number {
  return (
    b.score - a.score ||
    a.titleLine - b.titleLine ||
    a.titleOffset - b.titleOffset ||
    TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
  );
}

/** Detect type, default role, confidence and a fixed-template reason for one file. */
export function detectDocument(input: DetectInput): DetectResult {
  const fileName = normalizeFileName(input.name);
  const titles = [...input.titleLines, ...(input.headings ?? []).slice(0, 12)]
    .map(lower)
    .filter((t) => t.length <= TITLE_LINE_MAX && !/[.]\s*$/.test(t));
  const head = lower(input.headText.slice(0, 1500));
  const titleIdx = titleLineIndex(titles);
  const scores = DETECT_RULES.map((r) => scoreRule(r, fileName, titles, titleIdx, head)).sort(
    compare,
  );
  const top = scores[0]!;
  const runner = scores[1]?.score ?? 0;
  const secCover =
    !scores.some((s) => s.type === 'sub_agreement' && s.title) &&
    SEC_COVER_PHRASES.find((p) => head.includes(p));
  if (top.score === 0 || (secCover && !top.title)) {
    if (secCover)
      return {
        type: 'ppm',
        role: 'reference',
        confidence: 'low',
        reason: `Opening text mentions "${secCover}"`,
      };
    return { type: 'other', role: 'reference', confidence: 'low', reason: NO_MATCH_REASON };
  }
  const confidence: PackageConfidence = top.score >= 3 && top.score - runner >= 2 ? 'high' : 'low';
  const reason = top.title
    ? `Title says "${top.title}"`
    : top.file
      ? `File name contains "${top.file}"`
      : `Opening text mentions "${top.body}"`;
  return {
    type: top.type,
    role: top.type === 'sub_agreement' ? 'to_digitize' : 'reference',
    confidence,
    reason,
  };
}

/**
 * Package-level role rules: one subscription agreement becomes `to_digitize`; two or more are
 * all `low` and held for the analyst; non-sub types are `reference`; a prior/previous/baseline
 * name hint proposes `baseline` at `low` (never auto-assigned at `high`). Confirmed rows are kept.
 */
export function resolveRoles(docs: readonly PackageDocument[]): PackageDocument[] {
  const subs = docs.filter((d) => d.type === 'sub_agreement' && !hasBaselineHint(d.name));
  return docs.map((d) => {
    if (d.confirmed) return { ...d };
    if (hasBaselineHint(d.name) && d.type === 'sub_agreement')
      return {
        ...d,
        role: 'baseline',
        confidence: 'low',
        reason: `File name contains "${BASELINE_NAME_HINTS.find((h) => hasToken(normalizeFileName(d.name), h))}"`,
      };
    if (d.type !== 'sub_agreement') return { ...d, role: 'reference' };
    if (subs.length >= 2)
      return { ...d, role: 'to_digitize', confidence: 'low', reason: TWO_SUBS_REASON };
    return { ...d, role: 'to_digitize' };
  });
}

function hasBaselineHint(name: string): boolean {
  const f = normalizeFileName(name);
  return BASELINE_NAME_HINTS.some((h) => hasToken(f, h));
}

function rankOf(d: PackageDocument): number {
  if (d.confirmed) return 4;
  if (d.suggestionSource === 'ai') return 1;
  if (d.type === 'other' && d.reason === NO_MATCH_REASON) return 0;
  return d.confidence === 'high' ? 3 : 2;
}

/**
 * Merge an AI suggestion (seam only, AC-I7). Precedence: confirmed analyst > high rule > low rule
 * > AI suggestion. The suggestion is stored only when it outranks the current value, never over
 * a confirmed value, and always at `low` confidence.
 */
export function mergeSuggestion(
  doc: PackageDocument,
  suggestion: { type: PackageDocType; confidence: PackageConfidence } | null | undefined,
): PackageDocument {
  if (!suggestion || rankOf(doc) >= 1) return { ...doc };
  return {
    ...doc,
    type: suggestion.type,
    role: suggestion.type === 'sub_agreement' ? 'to_digitize' : 'reference',
    confidence: 'low',
    suggestionSource: 'ai',
    reason: 'Suggested by AI; please confirm.',
  };
}
