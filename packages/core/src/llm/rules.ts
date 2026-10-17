import { normalize } from '../memory/normalize';
import { rulesHash } from '../memory/rulesHash';

/**
 * Firm-rule injection (Phase 05, shared by the Worker and the engine worker).
 * Rules are context for the model, never instructions and never a filter.
 *
 * Normalization: NFC, collapse whitespace, trim (display text keeps its case).
 * Selection: sort by code unit, skip rules longer than `maxRuleCodePoints`, then take the first
 * rules that fit both `maxRules` and `maxTotalBytes` (UTF-8 bytes of the rule texts). Truncation is
 * deterministic and always reported as "N of M" (never a silent drop).
 */
export const RULES_CAPS = Object.freeze({
  maxRules: 20,
  maxRuleCodePoints: 500,
  maxTotalBytes: 4096,
});

export const UNTRUSTED_RULES_TAG = 'untrusted_firm_rules';
export const UNTRUSTED_DOCUMENT_TAG = 'untrusted_document_excerpts';

export interface InjectedRules {
  /** Normalized, sorted rule texts actually sent to the model. */
  texts: string[];
  /** N: rules injected. */
  applied: number;
  /** M: non-empty rules supplied. */
  total: number;
  /** true when applied < total. */
  truncated: boolean;
  /** core `rulesHash` over the injected set ('none' when empty). */
  hash: string;
  /** First 8 hex chars of `hash`, or the literal 'none'. */
  hash8: string;
}

/** NFC, collapse any whitespace run to one space, trim. */
export function normalizeRuleText(t: string): string {
  return t.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function codePoints(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

const enc = new TextEncoder();

/** Deterministic, order-independent selection of the rules injected into the prompt. */
export function selectInjectedRules(ruleTexts: readonly string[]): InjectedRules {
  const all = ruleTexts
    .map(normalizeRuleText)
    // also drop texts the core rulesHash would ignore (e.g. only zero-width characters)
    .filter((t) => t.length > 0 && normalize(t).length > 0)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const texts: string[] = [];
  let bytes = 0;
  for (const t of all) {
    if (texts.length >= RULES_CAPS.maxRules) break;
    if (codePoints(t) > RULES_CAPS.maxRuleCodePoints) continue;
    const b = enc.encode(t).length;
    if (bytes + b > RULES_CAPS.maxTotalBytes) continue;
    texts.push(t);
    bytes += b;
  }
  const hash = rulesHash(texts);
  return {
    texts,
    applied: texts.length,
    total: all.length,
    truncated: texts.length < all.length,
    hash,
    hash8: rulesHash8(hash),
  };
}

/** core `rulesHash` over the injected set; equals `rulesHash(ruleTexts)` whenever no cap applies. */
export function injectedRulesHash(ruleTexts: readonly string[]): string {
  return selectInjectedRules(ruleTexts).hash;
}

/** First 8 hex chars of a rules hash, or the literal 'none'. */
export function rulesHash8(hash: string): string {
  return hash === 'none' ? 'none' : hash.slice(0, 8);
}

/**
 * Escape a JSON string for embedding inside a delimited tag: `<`, `>`, `&`, U+2028 and U+2029
 * become `\uXXXX` escapes (still valid JSON), so no literal tag can appear from untrusted text.
 */
export function escapeForTag(json: string): string {
  return json.replace(
    /[<>&\u2028\u2029]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'),
  );
}

/** `<tag>\n<escaped JSON>\n</tag>` around any untrusted value. */
export function untrustedBlock(tag: string, value: unknown): string {
  return `<${tag}>\n${escapeForTag(JSON.stringify(value))}\n</${tag}>`;
}

/** Rules block for the prompt ('' when no rules are injected). */
export function rulesBlock(sel: InjectedRules): string {
  return sel.applied === 0 ? '' : untrustedBlock(UNTRUSTED_RULES_TAG, sel.texts);
}

/** "N of M firm rules applied" (client notice). */
export function rulesAppliedNotice(sel: Pick<InjectedRules, 'applied' | 'total'>): string {
  return `${sel.applied} of ${sel.total} firm rules applied`;
}
