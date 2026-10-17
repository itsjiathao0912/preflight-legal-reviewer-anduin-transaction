import { typesIn } from '../investor/types';
import {
  acceptsDate,
  acceptsFormat,
  acceptsName,
  acceptsRename,
  acceptsRenumber,
  nameSwapShape,
  type CosmeticContext,
} from './cosmetic';
import type { ClassifiedHunk, Hunk, RuleId } from './types';

/**
 * Ordered, deterministic classification (DECISION D1 as amended by plan G2/G3; this plan governs).
 *  1. whole unit added -> new (VAR-NEW-UNIT); removed -> changed_logic (VAR-LOGIC-REMOVED);
 *     moved with identical text -> cosmetic (VAR-COS-MOVED); pure insertion of at least
 *     `new_min_words` words -> new (VAR-NEW-INSERTION)
 *  2. logic guards on the CHANGED tokens only. G2: a hunk whose only digits are a section number
 *     mapped by the alignment (VAR-COS-RENUMBER) or a cover/header date (VAR-COS-DATE) has those
 *     digits removed from the guarded set first; every other guard still wins
 *  3. positive cosmetic rules: renumber / date (if accepted above), format, name, rename
 *  4. default -> changed_logic (VAR-LOGIC-DEFAULT). Unknown means logic.
 */

const WORD = /[\p{L}\p{N}]/u;
const DIGIT = /\p{N}/u;

export function wordCount(tokens: readonly string[]): number {
  return tokens.filter((t) => WORD.test(t)).length;
}

/** First guard that fires on the changed tokens (digits ignored when `digitsExplained`). */
export function guardHit(
  h: Hunk,
  ctx: CosmeticContext,
  digitsExplained: boolean,
): RuleId | undefined {
  if (h.truncated) return 'VAR-LOGIC-GUARD-TRUNCATED';
  const g = ctx.rules.config.guards;
  const toks = [...h.oldTokens, ...h.newTokens];
  const lower = toks.map((t) => t.toLowerCase());
  if (lower.some((t) => g.amount_tokens.includes(t))) return 'VAR-LOGIC-GUARD-AMOUNT';
  if (!digitsExplained && toks.some((t) => DIGIT.test(t))) return 'VAR-LOGIC-GUARD-DIGIT';
  if (lower.some((t) => g.negation.includes(t))) return 'VAR-LOGIC-GUARD-NEGATION';
  if (lower.some((t) => g.modals.includes(t))) return 'VAR-LOGIC-GUARD-MODAL';
  if (lower.some((t) => g.conditions.includes(t))) return 'VAR-LOGIC-GUARD-CONDITION';
  if (typesIn(toks.join(' ')).length) return 'VAR-LOGIC-GUARD-INVESTOR';
  if (lower.some((t) => g.jurisdiction.includes(t))) return 'VAR-LOGIC-GUARD-JURISDICTION';
  return undefined;
}

export function classifyHunk(h: Hunk, ctx: CosmeticContext): ClassifiedHunk {
  const out = (cls: ClassifiedHunk['class'], ruleId: RuleId, groupKey?: string) =>
    groupKey ? { ...h, class: cls, ruleId, groupKey } : { ...h, class: cls, ruleId };
  // step 1
  if (h.whole === 'added') return out('new', 'VAR-NEW-UNIT');
  if (h.whole === 'removed') return out('changed_logic', 'VAR-LOGIC-REMOVED');
  if (h.kind === 'move') return out('changed_cosmetic', 'VAR-COS-MOVED', 'VAR-COS-MOVED');
  if (
    h.kind === 'insert' &&
    !h.truncated &&
    wordCount(h.newTokens) >= ctx.rules.config.new_min_words
  )
    return out('new', 'VAR-NEW-INSERTION');
  // step 2 (G2 digit-guard exemption first)
  const digitRule: RuleId | undefined = acceptsRenumber(h, ctx)
    ? 'VAR-COS-RENUMBER'
    : acceptsDate(h, ctx)
      ? 'VAR-COS-DATE'
      : undefined;
  const guard = guardHit(h, ctx, digitRule !== undefined);
  if (guard) return out('changed_logic', guard);
  // step 3
  if (digitRule) return out('changed_cosmetic', digitRule, digitRule);
  // format first: "equal after case / punctuation normalization" is the strictest claim
  if (acceptsFormat(h)) return out('changed_cosmetic', 'VAR-COS-FORMAT', 'VAR-COS-FORMAT');
  const name = acceptsName(h, ctx);
  if (name) {
    const [from, to] = name.split('\u0000');
    return out('changed_cosmetic', 'VAR-COS-NAME', `VAR-COS-NAME:${from} -> ${to}`);
  }
  const rename = acceptsRename(h, ctx);
  if (rename)
    return out(
      'changed_cosmetic',
      'VAR-COS-RENAME',
      `VAR-COS-RENAME:${rename.from} -> ${rename.to}`,
    );
  // step 4
  return out('changed_logic', 'VAR-LOGIC-DEFAULT');
}

/** Count name-swap shapes across the pair (VAR-COS-NAME needs at least N occurrences). */
export function countSwaps(
  hunks: readonly Hunk[],
  ctx: Omit<CosmeticContext, 'swapCounts'>,
): Map<string, number> {
  const counts = new Map<string, number>();
  const full: CosmeticContext = { ...ctx, swapCounts: counts };
  for (const h of hunks) {
    const shape = nameSwapShape(h, full);
    if (shape) counts.set(shape, (counts.get(shape) ?? 0) + 1);
  }
  return counts;
}

export function classifyAll(hunks: readonly Hunk[], ctx: CosmeticContext): ClassifiedHunk[] {
  return hunks.map((h) => classifyHunk(h, ctx));
}
