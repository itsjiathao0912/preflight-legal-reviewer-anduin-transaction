import { alignUnits, buildUnits, type Unit } from '../diff/align';
import { foldTerm } from '../diff/normalize-key';
import { inferRenames } from '../diff/rename-inference';
import type { Finding } from '../findings/schema';
import { buildChangeFinding, varianceMetaOf } from './adapter';
import { classifyAll, countSwaps } from './classify';
import { cosmeticGroups, sectionOfKey, type CosmeticContext } from './cosmetic';
import { buildHunks, type UnitPair } from './hunks';
import { computeImpact } from './impact';
import { assertionCandidateOf } from './regression';
import { defaultVarianceRules } from './rules';
import { routeChange } from './routing';
import type {
  ClassifiedHunk,
  RuleId,
  VarianceInput,
  VarianceMeta,
  VarianceResult,
  VarianceSide,
} from './types';

/**
 * `runVariance` (D1-D4, D8): pure, deterministic, no AI input, no regression checks. Same-firm
 * guard first (step 0), then hunks from full unit text, ordered classification, display-only
 * cosmetic groups, one change row per aligned unit (non-cosmetic hunks), impact, owner routing and
 * the Finding adapter. Output is plain JSON.
 */

function emptyResult(notice?: 'cross_firm'): VarianceResult {
  return {
    findings: [],
    meta: {},
    cosmeticGroups: [],
    summary: { raw: 0, shown: 0, cosmetic: 0, new: 0, changed_logic: 0 },
    rawChanges: [],
    ...(notice ? { notice } : {}),
  };
}

/** Old -> new section number from aligned section / part units; ambiguous numbers are dropped. */
export function numberMapOf(pairs: readonly UnitPair[]): Map<string, string> {
  const map = new Map<string, string>();
  const bad = new Set<string>();
  for (const { a, b } of pairs) {
    const na = sectionOfKey(a.key);
    const nb = sectionOfKey(b.key);
    if (!na || !nb || a.kind === 'scope' || b.kind === 'scope') continue;
    const prev = map.get(na);
    if (prev !== undefined && prev !== nb) bad.add(na);
    else map.set(na, nb);
  }
  for (const k of bad) map.delete(k);
  return map;
}

function displayOf(u: Unit): string {
  const sec = sectionOfKey(u.key);
  const part = /\/p([a-z])(?=#|$)/.exec(u.key)?.[1];
  if (sec)
    return `Section ${sec.toUpperCase()}${part ? ` Part ${part.toUpperCase()}` : ''} "${u.title}"`;
  return `"${u.title}"`;
}

/** Block index (in the structure) holding char offset `at` of the unit text. */
function blockAt(u: Unit, at: number): { blockIndex: number; start: number; end: number } {
  let pos = 0;
  const lines = u.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const end = pos + lines[i]!.length;
    if (at <= end || i === lines.length - 1)
      return { blockIndex: u.blockIndices[i]!, start: pos, end };
    pos = end + 1;
  }
  return { blockIndex: u.blockIndices[0]!, start: 0, end: 0 };
}

/** Distinct clause texts (blocks) touched by the hunks on one side, joined by " … ". */
function clauses(u: Unit | undefined, spans: Array<[number, number]>): string {
  if (!u) return '';
  const lines = u.text.split('\n');
  const seen = new Set<number>();
  const out: string[] = [];
  for (const [s, e] of spans) {
    for (const at of [s, Math.max(s, e - 1)]) {
      const b = blockAt(u, at);
      const i = u.blockIndices.indexOf(b.blockIndex);
      if (i < 0 || seen.has(i)) continue;
      seen.add(i);
      out.push(lines[i]!.replace(/\s+/g, ' ').trim());
    }
  }
  return out.filter(Boolean).join(' … ');
}

export function runVariance(input: VarianceInput): VarianceResult {
  const rules = input.rules ?? defaultVarianceRules();
  const a: VarianceSide = input.baseline;
  const b: VarianceSide = input.current;
  // step 0: hard same-firm guard
  if (!a.firmId || !b.firmId || a.firmId !== b.firmId) return emptyResult('cross_firm');

  const A = buildUnits(a.structure);
  const B = buildUnits(b.structure);
  const al = alignUnits(A, B);
  const cfg = rules.config;
  const { hunks, aligned, pairs } = buildHunks(A, B, al, {
    mergeGap: cfg.hunk.merge_gap_tokens,
    maxEditLength: cfg.hunk.max_edit_length,
  });
  const renames = inferRenames(aligned);
  const byKeyA = new Map(A.map((u) => [u.key, u] as const));
  const byKeyB = new Map(B.map((u) => [u.key, u] as const));
  const definedTerms = new Set(
    [...a.structure.definedTerms, ...b.structure.definedTerms].map((d) => foldTerm(d.term)),
  );
  const base: Omit<CosmeticContext, 'swapCounts'> = {
    rules,
    numberMap: numberMapOf(pairs),
    kindA: new Map(A.map((u) => [u.key, u.kind] as const)),
    kindB: new Map(B.map((u) => [u.key, u.kind] as const)),
    textA: new Map(A.map((u) => [u.key, u.text] as const)),
    textB: new Map(B.map((u) => [u.key, u.text] as const)),
    renames,
    definedTerms,
  };
  const ctx: CosmeticContext = { ...base, swapCounts: countSwaps(hunks, base) };
  const rawChanges = classifyAll(hunks, ctx);
  const groups = cosmeticGroups(rawChanges, rules);

  // one change row per aligned unit (pair, added or removed), in raw order
  const rows = new Map<string, ClassifiedHunk[]>();
  for (const h of rawChanges) {
    if (h.class === 'changed_cosmetic') continue;
    const k = `${h.unitKeyA ?? ''}|${h.unitKeyB ?? ''}`;
    const list = rows.get(k);
    if (list) list.push(h);
    else rows.set(k, [h]);
  }

  const baselineDoc = a.label ?? a.structure.docHash.slice(0, 12);
  const findings: Finding[] = [];
  const meta: Record<string, VarianceMeta> = {};
  let nNew = 0;
  let nLogic = 0;
  for (const hs of rows.values()) {
    const first = hs[0]!;
    const ua = first.unitKeyA ? byKeyA.get(first.unitKeyA) : undefined;
    const ub = first.unitKeyB ? byKeyB.get(first.unitKeyB) : undefined;
    const added = first.whole === 'added';
    const removed = first.whole === 'removed';
    // G3: new if the unit was added or every non-cosmetic hunk is a step-1 insertion
    const allInsertions = hs.every((h) => h.ruleId === 'VAR-NEW-INSERTION');
    const changeType = added || (!removed && allInsertions) ? 'new' : 'changed_logic';
    const ruleId: RuleId = added
      ? 'VAR-NEW-UNIT'
      : removed
        ? 'VAR-LOGIC-REMOVED'
        : allInsertions
          ? 'VAR-NEW-INSERTION'
          : hs.find((h) => h.ruleId !== 'VAR-NEW-INSERTION')!.ruleId;
    const unit = (ub ?? ua)!;
    const title = added
      ? `New ${displayOf(unit)}`
      : removed
        ? `Removed ${displayOf(unit)}`
        : allInsertions
          ? `New text in ${displayOf(unit)}`
          : `Changed ${displayOf(unit)}`;
    const oldClause = clauses(
      ua,
      hs.map((h) => [h.oldStart, h.oldEnd]),
    );
    const newClause = clauses(
      ub,
      hs.map((h) => [h.newStart, h.newEnd]),
    );
    const changedText = hs.map((h) => `${h.oldText} ${h.newText}`.trim()).join(' ');
    const impact = computeImpact(
      { changedText, oldClause, newClause, title: unit.title },
      { structure: a.structure, graph: a.graph, unit: ua },
      { structure: b.structure, graph: b.graph, unit: ub },
      rules,
    );
    const route = routeChange(
      {
        changeType,
        title: unit.title,
        ruleId,
        text: `${changedText} ${unit.title}`,
        audienceRestricted: impact.audience?.restricted ?? false,
      },
      rules,
    );
    const assertion =
      added || removed
        ? assertionCandidateOf({
            status: added ? 'added' : 'removed',
            unitKind: unit.kind,
            unitKey: unit.key,
            title: unit.title,
          })
        : undefined;
    // anchor: the new-document block of the first hunk; doc start for a removed unit
    const anchor = ub ? blockAt(ub, first.newStart) : { blockIndex: -1, start: 0, end: 0 };
    const offStart = ub ? Math.max(0, first.newStart - anchor.start) : 0;
    const offEnd = ub ? Math.max(offStart, Math.min(first.newEnd, anchor.end) - anchor.start) : 0;
    const f = buildChangeFinding(
      {
        docHash: b.structure.docHash,
        anchorStructure: b.structure,
        blockIndex: anchor.blockIndex,
        offsetStart: offStart,
        offsetEnd: offEnd,
        quote: ub ? newClause || unit.title : oldClause || unit.title,
        quoteSide: ub ? 'new' : 'old',
        changeType,
        ruleId,
        title,
        owners: route.owners,
        ownerReason: route.reason,
        oldText: oldClause,
        newText: newClause,
        unitKeyA: ua?.key ?? null,
        unitKeyB: ub?.key ?? null,
        hunkCount: hs.length,
        impact,
        ...(assertion ? { assertion } : {}),
        baselineDoc,
      },
      rules,
    );
    // identical rows (same anchor and quote) collapse to one finding id: keep the first
    if (meta[f.id]) continue;
    findings.push(f);
    meta[f.id] = varianceMetaOf(f)!;
    if (changeType === 'new') nNew++;
    else nLogic++;
  }
  const cosmetic = rawChanges.filter((h) => h.class === 'changed_cosmetic').length;
  return {
    findings,
    meta,
    cosmeticGroups: groups,
    summary: {
      raw: rawChanges.length,
      shown: findings.length,
      cosmetic,
      new: nNew,
      changed_logic: nLogic,
    },
    rawChanges,
  };
}
