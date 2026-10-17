import type { Unit } from '../diff/align';
import type { DocGraph } from '../graph/graph';
import { investorModelOf } from '../investor/paths';
import {
  FAMILY,
  INVESTOR_TYPES,
  TYPE_LABELS,
  typesIn,
  type InvestorTypeId,
} from '../investor/types';
import type { Conditional, Structure } from '../structure/types';
import { diffAudience } from './audience';
import { sectionOfKey } from './cosmetic';
import type { VarianceRules } from './rules';
import type { ImpactResult } from './types';

/**
 * Form impact (DECISION D3): a pure function over data already prepared (no new graph engine).
 *  - investor types: union over both sides of investor paths whose sections / questions include
 *    the changed unit's section, plus `typesIn(changed text)`, plus the entity families of an
 *    audience restriction
 *  - conditional paths: conditionals inside the changed unit or targeting its section, as
 *    old -> new pairs
 *  - old form rule reusable = yes only when no investor type and no conditional is affected, the
 *    unit touches no conditional / question / option / field, both sides' affected sets are equal
 *    and nothing is uncertain; unknown or an uncertain investor path = no (flagged uncertain)
 */

export interface ImpactSide {
  structure: Structure;
  graph: DocGraph;
  unit?: Unit;
}

export interface ImpactInput {
  /** Changed text (old + new hunk text of the row). */
  changedText: string;
  oldClause: string;
  newClause: string;
  title: string;
}

const desc = (c: Conditional) =>
  `${c.trigger.trim().replace(/[,;:]+$/, '')} -> ${c.action} ${c.targets.join(', ')}`
    .replace(/\s+/g, ' ')
    .slice(0, 200);

function pathTypes(side: ImpactSide): { types: Set<InvestorTypeId>; uncertain: boolean } {
  const types = new Set<InvestorTypeId>();
  const sec = sectionOfKey(side.unit?.key);
  if (!side.unit) return { types, uncertain: false };
  const model = investorModelOf(side.graph);
  if (!model.types.length) return { types, uncertain: true };
  let uncertain = false;
  if (sec)
    for (const p of model.paths) {
      const hit =
        p.sections.some((s) => s.toLowerCase() === sec) ||
        p.questions.some((q) => q.section.toLowerCase() === sec);
      if (!hit) continue;
      types.add(p.type);
      if (p.uncertain) uncertain = true;
    }
  return { types, uncertain };
}

function unitConditionals(side: ImpactSide): Conditional[] {
  const u = side.unit;
  if (!u) return [];
  const blocks = new Set(u.blockIndices);
  const sec = sectionOfKey(u.key);
  return side.structure.conditionals.filter(
    (c) =>
      blocks.has(c.blockIndex) ||
      (sec !== undefined && c.targets.some((t) => t.toLowerCase() === `section ${sec}`)),
  );
}

function touchesForm(side: ImpactSide): boolean {
  const u = side.unit;
  if (!u) return false;
  const blocks = new Set(u.blockIndices);
  const s = side.structure;
  return (
    s.conditionals.some((c) => blocks.has(c.blockIndex)) ||
    s.optionGroups.some((g) => g.blockIndices.some((b) => blocks.has(b))) ||
    s.fields.some((f) => blocks.has(f.blockIndex))
  );
}

export function computeImpact(
  change: ImpactInput,
  A: ImpactSide,
  B: ImpactSide,
  rules: VarianceRules,
): ImpactResult {
  const pa = pathTypes(A);
  const pb = pathTypes(B);
  const types = new Set<InvestorTypeId>([...pa.types, ...pb.types]);
  for (const t of typesIn(change.changedText)) types.add(t);
  const audience = diffAudience(
    change.oldClause,
    change.newClause,
    rules,
    change.title.toLowerCase(),
  );
  if (audience?.restricted)
    for (const t of INVESTOR_TYPES) if (audience.families.includes(FAMILY[t])) types.add(t);

  const ca = unitConditionals(A).map(desc);
  const cb = unitConditionals(B).map(desc);
  const conditionals: ImpactResult['conditionals'] = [];
  for (let i = 0; i < Math.max(ca.length, cb.length); i++)
    conditionals.push({ old: ca[i] ?? null, new: cb[i] ?? null });

  const sameSets = pa.types.size === pb.types.size && [...pa.types].every((t) => pb.types.has(t));
  const uncertain = pa.uncertain || pb.uncertain;
  const reusable =
    types.size === 0 &&
    conditionals.length === 0 &&
    !touchesForm(A) &&
    !touchesForm(B) &&
    sameSets &&
    !uncertain &&
    !audience?.restricted
      ? 'yes'
      : 'no';
  const investorTypes = INVESTOR_TYPES.filter((t) => types.has(t));
  const typeText = investorTypes.length
    ? investorTypes.map((t) => TYPE_LABELS[t]).join(', ')
    : 'no investor types';
  const line =
    audience?.line ??
    `${typeText} affected; ${conditionals.length} conditional path(s) affected; old form rule reusable: ${reusable}${uncertain ? ' (uncertain)' : ''}`;
  return { investorTypes, conditionals, reusable, uncertain, audience, line };
}

/** Label for the impact block (UI copy is V2's; core states the provenance). */
export const IMPACT_PROVENANCE = 'from the logic graph and qualifier rules, deterministic';
