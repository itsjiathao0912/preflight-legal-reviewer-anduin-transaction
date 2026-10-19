import { sha256Hex } from '../model/hash';
import type { Line } from '../model/types';
import { isCaps } from '../model/line-stream';
import { cellTextsOf } from '../adapters/cell-texts';
import type { Scope, ScopeKind } from './types';

/**
 * Numbering scopes (H.4). A scope opens at a bold/caps short line naming
 * Instructions, Terms and Conditions, Signature Pages or Appendix X, or at a
 * document-level Part X (before any accepted section in the region), or when
 * section numbering resets to 1 after a larger number.
 */
const OPENERS: ReadonlyArray<{ kind: ScopeKind; re: RegExp }> = [
  { kind: 'appendix', re: /\bappendix\s+[a-z0-9]{1,3}\b/i },
  { kind: 'signature', re: /\bsignature\s+pages?\b/i },
  { kind: 'terms', re: /\bterms\s+(?:and|&)\s+conditions\b/i },
  { kind: 'instructions', re: /\binstructions\b/i },
];

export function scopeOpener(line: Line): ScopeKind | null {
  const text = line.text.trim();
  if (text.length > 120 || text.length < 4) return null;
  if (/^\s*(\d|\(|☐|☒)/.test(text)) return null;
  if (/[.;:]\s*$/.test(text)) return null;
  if (!line.cue.bold && !isCaps(text)) return null;
  // a multi-cell table header row ("Select one | Investor type | Instructions") names columns
  if (cellTextsOf(line).length >= 2) return null;
  for (const o of OPENERS) if (o.re.test(text)) return o.kind;
  return null;
}

export function scopeId(kind: ScopeKind, title: string, ordinal: number): string {
  return 'scope_' + sha256Hex(`${kind}|${title}|${ordinal}`).slice(0, 16);
}

export function newScope(
  kind: ScopeKind,
  title: string,
  ordinal: number,
  startBlock: number,
): Scope {
  return { id: scopeId(kind, title, ordinal), kind, title, ordinal, startBlock, sections: [] };
}

/** Title tokens used for qualifier matching ("of the Subscription Agreement Signature Pages"). */
export function titleTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['the', 'and', 'for', 'this'].includes(t)),
  );
}
