import type { CosmeticGroup, VarianceGatePolicy } from '@aduin/core';
import type { FindingView } from '../../engine/types';
import { computeGate, hasNoText, type Row } from '../review/model';
import type { SevKey } from '../review/severity';

/**
 * Variance Phase 02: the ONE counts selector shared by the Findings segment, the header counts, the
 * sidebar badge and the gate (pill, popover, toasts). Pure, except the variance source registry
 * (`state/review.ts` reads the variance slice through it without importing the variance store).
 */

export interface VarianceSlice {
  /** Change rows of the open document (empty until the pass is ready). */
  findings: readonly FindingView[];
  /** Variance gate policy: present only when a baseline resolved and the pass is ready. */
  policy: VarianceGatePolicy | undefined;
}

const EMPTY: VarianceSlice = Object.freeze({ findings: [], policy: undefined });
let source: () => VarianceSlice = () => EMPTY;

/** Registered by the variance store at load; tests may register a fake. */
export function setVarianceSource(fn: () => VarianceSlice): void {
  source = fn;
}

export function varianceSlice(): VarianceSlice {
  return source();
}

export function isChange(r: Row): boolean {
  return r.f.kind === 'change';
}

/** Errors first, then change rows (both keyed by finding id; ids never collide across kinds). */
export function mergeFindings(
  errors: readonly FindingView[],
  changes: readonly FindingView[],
): FindingView[] {
  return changes.length ? [...errors, ...changes] : [...errors];
}

export interface ReviewGate {
  status: 'ready' | 'blocked';
  reasons: ReturnType<typeof computeGate>['reasons'];
  /** A document with no readable text was never checked: never Ready. */
  unreadable: boolean;
}

/** The single gate computation (view, pill, popover, toasts). Keeps the `unreadable` spread. */
export function reviewGate(
  rows: readonly Row[],
  result: { blocks: readonly unknown[] } | null | undefined,
  policy: VarianceGatePolicy | undefined,
): ReviewGate {
  return { ...computeGate(rows, policy), unreadable: hasNoText(result) };
}

/** Toast tail after a counsel answer (same gate as the pill). */
export function gateLineText(gate: ReviewGate): string {
  if (gate.unreadable) return 'The gate stays Not ready: no text could be read.';
  const n = gate.reasons.length;
  return n ? `${n} item${n > 1 ? 's' : ''} left on the gate.` : 'The gate is now Ready.';
}

/** Toast tail after a dismissal (same gate as the pill). */
export function dismissGateText(gate: ReviewGate): string {
  if (gate.unreadable) return 'The gate stays Not ready: no text could be read.';
  const n = gate.reasons.length;
  return n ? `${n} blocking reason${n > 1 ? 's' : ''} left.` : 'The gate is now Ready.';
}

export interface ReviewCounts {
  /** Severity chips: active (not dismissed) error rows only. */
  chips: Record<SevKey, number>;
  /** `Errors N` segment: active error rows. */
  errors: number;
  /** `Changes N` segment: active change rows (cosmetic changes are never rows). */
  changes: number;
  errorsOpen: number;
  changesOpen: number;
  /** Sidebar Findings badge: open rows (errors + changes). */
  open: number;
  counsel: number;
  /** Gate reasons (header "block digitization", pill badge before package reasons). */
  blocked: number;
}

export function reviewCounts(
  rows: readonly Row[],
  main: readonly Row[],
  gate: ReviewGate,
): ReviewCounts {
  const chips: Record<SevKey, number> = { block: 0, fix: 0, note: 0 };
  let errors = 0;
  let changes = 0;
  let errorsOpen = 0;
  let changesOpen = 0;
  for (const r of main) {
    const change = isChange(r);
    if (r.status !== 'dismissed') {
      if (change) changes++;
      else {
        errors++;
        chips[r.sev]++;
      }
    }
    if (r.status === 'open') {
      if (change) changesOpen++;
      else errorsOpen++;
    }
  }
  return {
    chips,
    errors,
    changes,
    errorsOpen,
    changesOpen,
    open: errorsOpen + changesOpen,
    counsel: rows.filter((r) => r.status === 'counsel').length,
    blocked: gate.reasons.length,
  };
}

/** Header meta line: unchanged when there are no change rows. */
export function headerMeta(c: ReviewCounts, hasChanges: boolean): string {
  if (!hasChanges) return `${c.open} open · ${c.blocked} block digitization`;
  return `${c.errorsOpen} errors open · ${c.changesOpen} changes to review · ${c.blocked} block digitization`;
}

export interface CappedGroups {
  shown: CosmeticGroup[];
  moreGroups: number;
  moreChanges: number;
}

/** Core cosmetic groups are uncapped: keep the first `max` in core order, count the rest. */
export function capCosmeticGroups(groups: readonly CosmeticGroup[], max = 5): CappedGroups {
  const shown = groups.slice(0, max);
  const rest = groups.slice(max);
  return {
    shown,
    moreGroups: rest.length,
    moreChanges: rest.reduce((n, g) => n + g.count, 0),
  };
}

export function moreGroupsLine(c: CappedGroups): string | null {
  return c.moreGroups ? `+${c.moreGroups} more groups (${c.moreChanges} changes)` : null;
}
