import { questionKey, type CounselOption, type GateReason, type Owner } from '@aduin/core';
import type { Row, Triage } from '../review/model';

/**
 * Variance Phase 04: the ONE owner model behind the Questions tabs, the per-owner export, the
 * sidebar badge and the gate popover groups (DECISION D4, H5, H6). Pure.
 *
 * - A change finding gets one question per asked owner, keyed `<findingId>@<owner>` by the core
 *   `questionKey`; "asked" = the owner's key is present in `Triage.ownerAnswers` (written at the Ask
 *   click), `null` = asked and not answered yet.
 * - An error finding keeps its plain key and belongs to Counsel (the core sheet default owner).
 * - The local-only owner "You" is never a question owner, never gets a key and never reaches the
 *   outbox: a change routed to "You" can only be decided in Findings.
 */
export const OWNER_ORDER: readonly Owner[] = ['counsel', 'gp', 'fund_admin'];

export const OWNER_LABEL: Readonly<Record<Owner, string>> = Object.freeze({
  counsel: 'Counsel',
  gp: 'GP',
  fund_admin: 'Fund admin',
});

/** Analyst choice in the owner select. `you` is local-only (no question, no key). */
export type OwnerChoice = 'counsel' | 'gp' | 'fund_admin' | 'gp+counsel' | 'you';

export const OWNER_CHOICES: readonly { value: OwnerChoice; label: string }[] = [
  { value: 'counsel', label: 'Counsel' },
  { value: 'gp', label: 'GP' },
  { value: 'fund_admin', label: 'Fund admin' },
  { value: 'gp+counsel', label: 'GP + Counsel' },
  { value: 'you', label: 'You (no confirmation needed)' },
];

export function isOwnerChoice(x: unknown): x is OwnerChoice {
  return OWNER_CHOICES.some((c) => c.value === x);
}

/** Owners a choice asks (canonical order); `you` asks nobody. */
export function choiceOwners(c: OwnerChoice): Owner[] {
  switch (c) {
    case 'you':
      return [];
    case 'gp+counsel':
      return ['counsel', 'gp'];
    default:
      return [c];
  }
}

/** Choice shown for a suggested owner list (two owners = "GP + Counsel"). */
export function choiceOf(owners: readonly Owner[]): OwnerChoice {
  const set = new Set(owners);
  if (set.size === 0) return 'you';
  if (set.size === 1) return [...set][0]!;
  if (set.size === 2 && set.has('gp') && set.has('counsel')) return 'gp+counsel';
  // any other pair (not produced by the routing table today): first suggested owner
  return owners[0]!;
}

export function ownersLabel(owners: readonly Owner[]): string {
  return owners.length ? owners.map((o) => OWNER_LABEL[o]).join(' + ') : 'You';
}

/** Effective owners of a change row: the analyst override when set, else the suggested owners. */
export function effectiveOwners(
  suggested: readonly Owner[],
  override: OwnerChoice | undefined,
): { owners: Owner[]; source: 'suggested' | 'override' } {
  if (override === undefined) return { owners: canonical(suggested), source: 'suggested' };
  return { owners: choiceOwners(override), source: 'override' };
}

function canonical(owners: readonly Owner[]): Owner[] {
  return OWNER_ORDER.filter((o) => owners.includes(o));
}

/** Owners asked for this finding (key present), canonical order. */
export function askedOwners(t: Triage | null | undefined): Owner[] {
  const oa = t?.ownerAnswers;
  return oa ? OWNER_ORDER.filter((o) => Object.prototype.hasOwnProperty.call(oa, o)) : [];
}

export const isClear = (o: CounselOption | null | undefined): boolean =>
  o === 'A' || o === 'B' || o === 'C';

export const isChangeRow = (r: Row): boolean => r.f.kind === 'change';

/** Regression finding (Variance R-01): the core pattern key of the scope_exists check. */
export const isRegressionRow = (r: Row | undefined): boolean =>
  r?.f.pattern_key === 'VAR-REG-SCOPE-EXISTS';

/** Error-finding question rule (unchanged Phase 08 rule; change rows use the asked markers). */
export function isErrorQuestion(r: Row): boolean {
  return r.status === 'counsel' || (r.status === 'accepted' && r.f.severity === 'critical');
}

export interface QuestionItem {
  /** Question key: `<findingId>@<owner>` for change findings, the plain id for error findings. */
  key: string;
  findingId: string;
  owner: Owner;
  row: Row;
  /** This question's answer (owner answer for change findings, counsel answer otherwise). */
  answer: CounselOption | null;
  change: boolean;
}

/** Every question of the document, document order then owner order. */
export function questionItems(rows: readonly Row[]): QuestionItem[] {
  const out: QuestionItem[] = [];
  const sorted = [...rows].sort((a, b) => a.f.order - b.f.order);
  for (const r of sorted) {
    if (isChangeRow(r)) {
      for (const o of askedOwners(r.triage)) {
        out.push({
          key: questionKey(r.f.id, o),
          findingId: r.f.id,
          owner: o,
          row: r,
          answer: r.triage?.ownerAnswers?.[o] ?? null,
          change: true,
        });
      }
    } else if (isErrorQuestion(r)) {
      out.push({
        key: r.f.id,
        findingId: r.f.id,
        owner: 'counsel',
        row: r,
        answer: r.triage?.counselAnswer ?? null,
        change: false,
      });
    }
  }
  return out;
}

export const itemNeedsAnswer = (q: QuestionItem): boolean => !isClear(q.answer);

/** Unanswered questions per owner (the Questions tab badges). */
export function ownerCounts(items: readonly QuestionItem[]): Record<Owner, number> {
  const c: Record<Owner, number> = { counsel: 0, gp: 0, fund_admin: 0 };
  for (const q of items) if (itemNeedsAnswer(q)) c[q.owner]++;
  return c;
}

export type GateGroupId = 'you' | Owner | 'earlier';

export const GATE_GROUP_ORDER: readonly GateGroupId[] = [
  'you',
  'counsel',
  'gp',
  'fund_admin',
  'earlier',
];

export const GATE_GROUP_LABEL: Readonly<Record<GateGroupId, string>> = Object.freeze({
  you: 'You',
  counsel: 'Counsel',
  gp: 'GP',
  fund_admin: 'Fund admin',
  earlier: 'Earlier funds',
});

export interface GroupedReason {
  reason: GateReason;
  row: Row | undefined;
  /** Inside "You": a document error that nobody was asked about ("Document errors" fallback). */
  documentError: boolean;
}

/**
 * Popover groups (F1, H6). Core gate reasons are per (finding, owner) pair, so each reason goes to
 * exactly one group and the group sizes sum to `reasons.length`:
 * - `reason.owner` set -> that owner's group;
 * - a regression finding or a prior-fund item (open here, awaiting an earlier fund's answer) ->
 *   "Earlier funds";
 * - an asked error finding (Needs counsel / accepted critical) -> Counsel (chip owner);
 * - anything else -> "You" (untriaged changes; unasked document errors as the fallback).
 */
export function gateGroups(
  reasons: readonly GateReason[],
  rows: readonly Row[],
): Record<GateGroupId, GroupedReason[]> {
  const byId = new Map(rows.map((r) => [r.f.id, r]));
  const g: Record<GateGroupId, GroupedReason[]> = {
    you: [],
    counsel: [],
    gp: [],
    fund_admin: [],
    earlier: [],
  };
  for (const reason of reasons) {
    const row = byId.get(reason.findingKey);
    if (reason.owner) {
      g[reason.owner].push({ reason, row, documentError: false });
      continue;
    }
    if (isRegressionRow(row) || isPriorFundItem(row)) {
      g.earlier.push({ reason, row, documentError: false });
      continue;
    }
    if (row && !isChangeRow(row) && isErrorQuestion(row)) {
      g.counsel.push({ reason, row, documentError: false });
      continue;
    }
    g.you.push({ reason, row, documentError: !!row && !isChangeRow(row) });
  }
  return g;
}

function isPriorFundItem(row: Row | undefined): boolean {
  return !!row && row.status === 'open' && row.label === 'awaiting_counsel';
}

/** Distinct finding keys of a reason list (two-owner findings count once). */
export function distinctFindingKeys(reasons: readonly GateReason[]): Set<string> {
  return new Set(reasons.map((r) => r.findingKey));
}
