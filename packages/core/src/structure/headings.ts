import { isCaps } from '../model/line-stream';
import type { Line } from '../model/types';

/**
 * Heading inference (Pinned Algorithm H). Operates on Line + Cue only.
 * Final thresholds are recorded in the Phase 01 report.
 */
export const HEADING_LIMITS = Object.freeze({
  /** Max title length for a section/part heading. */
  maxTitleChars: 120,
  /** Accepted forward gap (prev+2..prev+3) for a bold/caps candidate (non-cascading demotion). */
  maxGap: 3,
});

export interface SectionCandidate {
  kind: 'section';
  number: string;
  num: number;
  title: string;
  /** Title is a heading title (bold or caps, <=120 chars, no sentence-final period). */
  titleOk: boolean;
}

export interface PartCandidate {
  kind: 'part';
  letter: string;
  label: string;
  titleOk: boolean;
}

const SECTION_RE = /^\s*(\d{1,2}[A-Z]?)\.(?:\s+(.*))?$/;
/**
 * Keyword-led section headings (intake T14): `Section 4. Title`, `SECTION 4`, `Article 4.`,
 * `ARTICLE 4 TITLE`, `Article IV. Title`. Number grammar: `\d{1,2}[A-Z]?` or UPPERCASE roman
 * (Article only). The dot after the number must be followed by whitespace or end of line, so
 * dotted decimals (`Section 1.1`), cites (`Section 3(42)`) and `Section N:` lines never match.
 */
export const KEYWORD_SECTION_RE =
  /^\s*([Ss]ection|SECTION|[Aa]rticle|ARTICLE)\s{1,4}(\d{1,2}[A-Z]?|[IVXL]{1,6})(?:\.(?=\s|$))?(?:\s+(\S.{0,200}))?\s*$/;
const PART_RE = /^\s*Part\s+([A-Z])\b\s*(?:[–—:-]\s*)?(.*)$/i;

/** Title minus parenthetical groups and a trailing "*" (for the caps test). */
export function stripTitleNoise(title: string): string {
  let out = '';
  let depth = 0;
  for (const ch of title) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out.replace(/\*+\s*$/, '').trim();
}

/** Label = text up to the first "(" or 120 chars. */
export function labelOf(text: string): string {
  const paren = text.indexOf('(');
  const cut = paren === -1 ? text : text.slice(0, paren);
  return cut
    .slice(0, HEADING_LIMITS.maxTitleChars)
    .replace(/\*+\s*$/, '')
    .trim();
}

function titleIsHeading(title: string, line: Line): boolean {
  const t = title.trim();
  if (!t || t.length > HEADING_LIMITS.maxTitleChars) return false;
  if (/[.]\s*$/.test(t) && !/\b(No|Inc|Ltd|Co|Corp)\.$/.test(t)) return false;
  const stripped = stripTitleNoise(t);
  return line.cue.bold || isCaps(stripped || t);
}

/** Strict UPPERCASE roman numeral I..L to an integer; null if not canonical. */
export function romanToInt(s: string): number | null {
  if (!/^L?X{0,3}(?:IX|IV|V?I{0,3})$/.test(s) || s.length === 0) return null;
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]!]!;
    const b = i + 1 < s.length ? v[s[i + 1]!]! : 0;
    n += a < b ? -a : a;
  }
  return n > 0 ? n : null;
}

/**
 * Keyword-led heading candidate. Qualifies on the keyword, the number grammar and a bounded
 * title only (no bold/caps requirement): line at most 120 chars, no sentence-final period,
 * title not lowercase-led. Roman numbers convert to the arabic `number` string.
 */
export function keywordSectionCandidate(line: Line): SectionCandidate | null {
  const text = line.text;
  if (text.trim().length > HEADING_LIMITS.maxTitleChars) return null;
  const m = KEYWORD_SECTION_RE.exec(text);
  if (!m) return null;
  const head = m[1]!.toLowerCase();
  let raw = m[2]!;
  let num: number;
  if (/^\d/.test(raw)) num = Number.parseInt(raw, 10);
  else {
    if (head !== 'article') return null;
    const r = romanToInt(raw);
    if (r === null) return null;
    num = r;
    raw = String(r);
  }
  const title = (m[3] ?? '').trim();
  if (title) {
    if (!/^[A-Z0-9("“'‘]/.test(title)) return null;
    if (/[.]\s*$/.test(title) && !/\b(No|Inc|Ltd|Co|Corp)\.$/.test(title)) return null;
    if (/[:;]\s*$/.test(title)) return null;
  }
  return { kind: 'section', number: raw, num, title, titleOk: true };
}

export function sectionCandidate(line: Line): SectionCandidate | null {
  const m = SECTION_RE.exec(line.text);
  if (!m) return keywordSectionCandidate(line);
  const number = m[1]!;
  const title = (m[2] ?? '').trim();
  return {
    kind: 'section',
    number,
    num: Number.parseInt(number, 10),
    title,
    titleOk: titleIsHeading(title, line),
  };
}

export function partCandidate(line: Line): PartCandidate | null {
  const m = PART_RE.exec(line.text);
  if (!m) return null;
  const rest = (m[2] ?? '').trim();
  if (!rest) return null;
  // "Part A of Section 3" style prose is a reference, not a heading
  if (/^of\s+section\b/i.test(rest)) return null;
  const label = labelOf(rest);
  return {
    kind: 'part',
    letter: m[1]!.toUpperCase(),
    label,
    titleOk: label.length > 0 && (line.cue.bold || isCaps(stripTitleNoise(rest))),
  };
}

/** Own list number of a list item ("9. ...", "(9) ..."). */
export function listNumberOf(text: string): string | undefined {
  const m = /^\s*\(?(\d{1,2}[A-Z]?)[.)]\s/.exec(text);
  return m ? m[1] : undefined;
}

export function isListItemText(text: string): boolean {
  return /^\s*(?:\(?\d{1,2}[A-Z]?[.)]|\([a-z]{1,4}\)|[a-z][.)]|[•·▪●–-])\s/.test(text);
}
