import { foldTerm } from '../diff/normalize-key';
import type { Rename } from '../diff/types';
import type { VarianceRules } from './rules';
import type { ClassifiedHunk, CosmeticGroup, Hunk, RuleId } from './types';

/**
 * Positive cosmetic rules (DECISION D1 step 3, plus the G2 renumber / date digit rules). A hunk is
 * cosmetic only when one of these rules accepts it; unknown means logic. Cosmetic hunks never
 * become findings: they are grouped for display (rule id, plus the name / rename pair).
 */

export interface CosmeticContext {
  rules: VarianceRules;
  /** Old section number -> new section number from the alignment (lower-case). */
  numberMap: ReadonlyMap<string, string>;
  /** Unit kind by unit key, per side. */
  kindA: ReadonlyMap<string, string>;
  kindB: ReadonlyMap<string, string>;
  /** Unit text by unit key, per side. */
  textA: ReadonlyMap<string, string>;
  textB: ReadonlyMap<string, string>;
  renames: readonly Rename[];
  /** `foldTerm` of every defined term on either side. */
  definedTerms: ReadonlySet<string>;
  /** Occurrences of each name-swap shape (old\u0000new) across the pair. */
  swapCounts: ReadonlyMap<string, number>;
}

const NUMBER_TOKEN = /^\d{1,3}[a-z]?$/i;
const NAME_WORD = /^\p{Lu}[\p{L}'’-]*$/u;
const PUNCT = /^[^\p{L}\p{N}]+$/u;

/** Section number from a unit key (`body:1/s9`, `body:1/s6/pa`, `signature:1/s4a#2`). */
export function sectionOfKey(key: string | undefined): string | undefined {
  const m = key ? /\/s([0-9]{1,3}[a-z]?)(?=\/|#|$)/.exec(key) : null;
  return m ? m[1] : undefined;
}

/** Word immediately before `at` in `text` (or undefined at the start of the text / a block). */
function wordBefore(text: string | undefined, at: number): string | undefined {
  if (!text) return undefined;
  const head = text.slice(Math.max(0, at - 80), at);
  if (/\n\s*$/.test(head)) return undefined;
  const m = /([^\s]+)\s*$/.exec(head);
  return m ? m[1] : undefined;
}

/** Renumber (G2): every changed token is a section number the alignment maps old -> new. */
export function acceptsRenumber(h: Hunk, ctx: CosmeticContext): boolean {
  if (h.kind !== 'replace' || h.whole) return false;
  if (h.oldTokens.length !== h.newTokens.length || h.oldTokens.length === 0) return false;
  for (let i = 0; i < h.oldTokens.length; i++) {
    const o = h.oldTokens[i]!.toLowerCase();
    const n = h.newTokens[i]!.toLowerCase();
    if (!NUMBER_TOKEN.test(o) || !NUMBER_TOKEN.test(n) || o === n) return false;
    if (ctx.numberMap.get(o) !== n) return false;
  }
  // a reference label ("Section 9") or the heading number at the very start of the unit
  if (h.newStart === 0 && h.oldStart === 0) return true;
  const ctxWords = ctx.rules.config.cosmetic.renumber_context;
  const before = wordBefore(ctx.textB.get(h.unitKeyB ?? ''), h.newStart)?.toLowerCase();
  return before !== undefined && ctxWords.includes(before);
}

/** Cover / header date (G2): unit is a scope preamble; changed tokens are date parts only. */
export function acceptsDate(h: Hunk, ctx: CosmeticContext): boolean {
  if (h.kind !== 'replace' || h.whole) return false;
  if (ctx.kindB.get(h.unitKeyB ?? '') !== 'scope' || ctx.kindA.get(h.unitKeyA ?? '') !== 'scope')
    return false;
  const months = ctx.rules.config.cosmetic.months;
  let dateish = 0;
  for (const t of [...h.oldTokens, ...h.newTokens]) {
    const w = t.toLowerCase();
    if (PUNCT.test(w)) continue;
    const day = /^\d{1,2}$/.test(w) && Number(w) >= 1 && Number(w) <= 31;
    const year = /^(?:19|20)\d{2}$/.test(w);
    if (!(months.includes(w) || day || year)) return false;
    dateish++;
  }
  return dateish > 0;
}

/** The name-swap shape (before the occurrence count): capitalized 1..N-word replacement. */
export function nameSwapShape(h: Hunk, ctx: CosmeticContext): string | undefined {
  if (h.kind !== 'replace' || h.whole) return undefined;
  const max = ctx.rules.config.cosmetic.name_max_words;
  const ow = h.oldText.split(' ');
  const nw = h.newText.split(' ');
  if (ow.length > max || nw.length > max) return undefined;
  if (!ow.every((w) => NAME_WORD.test(w)) || !nw.every((w) => NAME_WORD.test(w))) return undefined;
  if (ctx.definedTerms.has(foldTerm(h.oldText)) || ctx.definedTerms.has(foldTerm(h.newText)))
    return undefined;
  // inside a proper name: the word before is capitalized on both sides
  const bA = wordBefore(ctx.textA.get(h.unitKeyA ?? ''), h.oldStart);
  const bB = wordBefore(ctx.textB.get(h.unitKeyB ?? ''), h.newStart);
  if (!bA || !bB || !/^\p{Lu}/u.test(bA) || !/^\p{Lu}/u.test(bB)) return undefined;
  return `${h.oldText}\u0000${h.newText}`;
}

export function acceptsName(h: Hunk, ctx: CosmeticContext): string | undefined {
  const shape = nameSwapShape(h, ctx);
  if (!shape) return undefined;
  return (ctx.swapCounts.get(shape) ?? 0) >= ctx.rules.config.cosmetic.name_min_occurrences
    ? shape
    : undefined;
}

export function acceptsRename(h: Hunk, ctx: CosmeticContext): Rename | undefined {
  if (h.kind !== 'replace' || h.whole) return undefined;
  const fo = foldTerm(h.oldText);
  const fn = foldTerm(h.newText);
  if (!fo || !fn) return undefined;
  return ctx.renames.find((r) => foldTerm(r.from) === fo && foldTerm(r.to) === fn);
}

/** Equal after case, whitespace and punctuation normalization. */
export function formatKey(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function acceptsFormat(h: Hunk): boolean {
  if (h.whole || h.kind === 'move') return false;
  return formatKey(h.oldText) === formatKey(h.newText);
}

/** Display-only groups of cosmetic hunks, in config rule order then key. */
export function cosmeticGroups(
  hunks: readonly ClassifiedHunk[],
  rules: VarianceRules,
): CosmeticGroup[] {
  const order = new Map(rules.config.rules.map((r, i) => [r.id, i] as const));
  const groups = new Map<string, CosmeticGroup>();
  for (const h of hunks) {
    if (h.class !== 'changed_cosmetic') continue;
    const key = h.groupKey ?? h.ruleId;
    let g = groups.get(key);
    if (!g) {
      g = {
        ruleId: h.ruleId,
        key,
        label: groupLabel(h.ruleId, key, rules),
        count: 0,
        examples: [],
      };
      groups.set(key, g);
    }
    g.count++;
    if (g.examples.length < 3) g.examples.push({ old: h.oldText, new: h.newText });
  }
  return [...groups.values()].sort(
    (x, y) =>
      (order.get(x.ruleId) ?? 99) - (order.get(y.ruleId) ?? 99) ||
      (x.key < y.key ? -1 : x.key > y.key ? 1 : 0),
  );
}

function groupLabel(ruleId: RuleId, key: string, rules: VarianceRules): string {
  const pair = key.indexOf(':');
  if (pair === -1) return rules.ruleLabel(ruleId);
  const [from, to] = key.slice(pair + 1).split(' -> ');
  return `${rules.ruleLabel(ruleId)}: "${from}" to "${to}"`;
}
