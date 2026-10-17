import type { CounselOption, MemoryLabel } from '../contracts/memory';
import type { Severity } from '../findings/severity';

/**
 * Phase 08 counsel gate + query sheet types (FROZEN at S0; implementations land in S1 as
 * `gate.ts` / `sheet.ts`). The shapes match `apps/web/src/features/review/gateInterim.ts`, which
 * becomes a thin re-export of `computeGate` in S2 and keeps exporting the same names.
 */
export type TriageStatus = 'open' | 'accepted' | 'counsel' | 'dismissed';
export type GateReasonKind =
  'open' | 'unanswered' | 'unclear' | 'awaiting_counsel' | 'reconfirm_required';
export type GateStatus = 'ready' | 'blocked';

export interface GateFinding {
  /** Finding key (engine-stable id). */
  id: string;
  severity: Severity;
  /** Optional; absent means `'rule'`. An `'ai'` finding never gates (L4). */
  detector_kind?: 'rule' | 'ai';
  /**
   * Variance: the caller marks a variance finding as gating-eligible regardless of severity
   * (critical = regression, otherwise a change). Only read when a `VarianceGatePolicy` is passed;
   * undefined keeps the legacy `isGating` rule.
   */
  gates?: boolean;
}

/** Variance question owners (mirrors `variance/types.ts` `Owner`). */
export type GateOwner = 'counsel' | 'gp' | 'fund_admin';

/** Variance gate policy (rules config `gate_policy`); undefined = exact legacy gate. */
export interface VarianceGatePolicy {
  /** An untriaged change finding (`gates: true`, not critical) blocks. */
  untriaged_change_blocks: boolean;
  /** An asked question without a clear A/B/C answer blocks, for any severity. */
  asked_unanswered_blocks: boolean;
  /** A regression finding (`gates: true`, critical) blocks. */
  regression_blocks: boolean;
}
export interface GateState {
  status: TriageStatus;
  /** Reason code recorded with a dismissal in this document. */
  reasonCode?: string | null;
  /** Counsel answer recorded for this finding (current document). */
  counselAnswer?: CounselOption | null;
  /**
   * Variance per-owner answers. A key PRESENT = that owner was asked; `null` = asked, not answered;
   * a missing key = not asked. Resolves only when every asked owner answered A/B/C.
   */
  ownerAnswers?: Partial<Record<GateOwner, CounselOption | null>>;
}
export interface GateReason {
  findingKey: string;
  kind: GateReasonKind;
  link: string;
  /** Variance: the asked owner this reason waits on (popover grouping). */
  owner?: GateOwner;
}
export interface GateResult {
  status: GateStatus;
  reasons: GateReason[];
}

/**
 * `computeGate(findings, states, labels, policy?)`: critical-only; AI findings never gate. With a
 * variance `policy` (optional 4th parameter) change / regression / asked-unanswered rows also gate.
 */
export type ComputeGate = (
  findings: readonly GateFinding[],
  states: Readonly<Record<string, GateState>>,
  labels: Readonly<Record<string, MemoryLabel>>,
  policy?: VarianceGatePolicy,
) => GateResult;

/**
 * Sheet inclusion: label `new` OR (status accepted AND needs counsel); `answered`/`unclear` in this
 * document returns as New; `already_answered`, `awaiting_counsel`, `previously_dismissed` are excluded.
 */
export interface SheetFinding extends GateFinding {
  issue_class: string;
  /** Clause location (section path / heading) for the citation. */
  location: string;
  /** Raw quote; the builder masks it (`mask(text, sensitiveSpans(text))`) and clamps to 1000 chars. */
  quote: string;
  /**
   * Variance: suggested owners of a change finding (one question per owner, key
   * `<findingId>@<owner>`). Absent = error finding (plain key; default owner counsel).
   */
  owners?: GateOwner[];
  /** Variance: change fields for the deterministic `version_drift` draft. */
  change?: { change_type: string; old_text: string; new_text: string };
}
export interface SheetQuestion {
  /** 1-based question number. */
  number: number;
  findingKey: string;
  link: string;
  location: string;
  /** Masked, <= 1000 chars. */
  quote: string;
  /** Interpretations A/B/C (1-6 items of 1-500 chars). */
  interpretations: string[];
}
export interface CounselSheetMeta {
  title: string;
  firm: string | null;
  fund: string | null;
  version: string | null;
  /** Variance: the owner this sheet is for (per-owner export); absent = all questions. */
  owner?: GateOwner;
}
export interface CounselSheet {
  meta: CounselSheetMeta;
  questions: SheetQuestion[];
}
