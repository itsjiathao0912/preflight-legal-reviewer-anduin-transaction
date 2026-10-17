/**
 * Normalized keys for alignment (D2): case-folded (neutralizes small caps such as "SubscripTIon"),
 * curly quotes and dashes folded, punctuation and whitespace collapsed. Pure and linear.
 */
export function normText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Heading key: parentheticals and trailing markers dropped, then `normText`. */
export function titleKey(title: string): string {
  return normText(title.replace(/\([^()]{0,200}\)/g, ' ').replace(/\*+/g, ' '));
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

function romanValue(s: string): number | undefined {
  if (!/^[ivxlc]{1,7}$/.test(s)) return undefined;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]!]!;
    const next = i + 1 < s.length ? ROMAN[s[i + 1]!]! : 0;
    total += v < next ? -v : v;
  }
  return total;
}

export interface Numbering {
  kind: 'number' | 'letter' | 'roman' | 'none';
  ordinal: number;
}

/**
 * Split a label ("12", "4A", "C", "iv") into {kind, ordinal}. A single letter other than i/v/x is a
 * letter; i, v, x alone are ambiguous and read as letters (A..Z), with the roman value used only as a
 * tie-break by callers that compare titles first.
 */
export function numbering(label: string | undefined): Numbering {
  const s = (label ?? '').trim().toLowerCase();
  if (!s) return { kind: 'none', ordinal: 0 };
  const num = /^(\d{1,4})/.exec(s);
  if (num) return { kind: 'number', ordinal: Number(num[1]) };
  if (/^[a-z]$/.test(s)) return { kind: 'letter', ordinal: s.charCodeAt(0) - 96 };
  const r = romanValue(s);
  if (r !== undefined) return { kind: 'roman', ordinal: r };
  return { kind: 'none', ordinal: 0 };
}

/** Trailing label of a scope title: "SUBSCRIPTION AGREEMENT – APPENDIX C" -> "c". */
export function scopeLabel(title: string): string | undefined {
  const m = /\b(?:appendix|exhibit|schedule|annex|part)\s+([a-z]{1,4}|\d{1,3})\b/i.exec(title);
  return m ? m[1]!.toLowerCase() : undefined;
}

/** Token set for Jaccard similarity. */
export function tokenSet(s: string): Set<string> {
  return new Set(normText(s).split(' ').filter(Boolean));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Lowercase + plural fold of the last word ("Units" -> "unit", "placement agents" -> "placement agent"). */
export function foldTerm(s: string): string {
  const words = normText(s).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  const last = words[words.length - 1]!;
  if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss')) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

/** Case-preserving plural fold of the last word ("Units" -> "Unit", "placement agents" -> "placement agent"). */
export function foldPlural(s: string): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const last = words[words.length - 1]!;
  if (last.length > 3 && /s$/.test(last) && !/ss$/i.test(last) && !/^[A-Z]+$/.test(last))
    words[words.length - 1] = last.slice(0, -1);
  return words.join(' ');
}
