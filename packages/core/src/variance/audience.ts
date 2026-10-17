import { FAMILY, typesIn } from '../investor/types';
import type { VarianceRules } from './rules';
import type { AudienceResult } from './types';

/**
 * Audience qualifiers (DECISION D3 jurisdiction gap). Diffs the audience dimensions named by the
 * old vs new clause; when the new text adds a restriction phrase ("formed or organized outside the
 * United States", "now applies only to"), the complement audience of each newly named dimension
 * loses the clause. Entity families come from `typesIn` plus the word "entity". Deterministic.
 */

const ENTITY_RE = /\bentit(?:y|ies)\b/i;
const FAMILY_PLURAL: Readonly<Record<string, string>> = {
  entity: 'entities',
  person: 'individuals',
  retirement: 'retirement accounts',
};

export function familiesIn(text: string): string[] {
  const out = new Set<string>(typesIn(text).map((t) => FAMILY[t]));
  if (ENTITY_RE.test(text)) out.add('entity');
  return [...out].sort();
}

export function diffAudience(
  oldText: string,
  newText: string,
  rules: VarianceRules,
  questionLabel: string,
): AudienceResult | null {
  const dimsIn = (t: string) =>
    rules.audience.filter((d) => d.patterns.some((re) => re.test(t))).map((d) => d.id);
  const before = new Set(dimsIn(oldText));
  const after = dimsIn(newText);
  const added = after.filter((d) => !before.has(d));
  const restriction = rules.restrictions.some((re) => re.test(newText) && !re.test(oldText));
  if (added.length === 0 && !restriction) return null;
  const byId = new Map(rules.audience.map((d) => [d.id, d] as const));
  const excluded = restriction
    ? [
        ...new Set(
          added
            .map((d) => byId.get(d)?.complement)
            .filter((c): c is string => !!c && !after.includes(c)),
        ),
      ].sort()
    : [];
  const families = familiesIn(newText);
  const restricted = restriction && excluded.length > 0;
  let line: string | null = null;
  if (restricted) {
    const fam = families.length
      ? families.map((f) => FAMILY_PLURAL[f] ?? f).join(' and ')
      : 'investors';
    const who = excluded.map((e) => byId.get(e)?.label ?? e).join(' and ');
    line = `${fam} affected; ${who} ${fam} lose the ${questionLabel} question; old rule not reusable`;
  }
  return { restricted, kept: [...added].sort(), excluded, families, line };
}
