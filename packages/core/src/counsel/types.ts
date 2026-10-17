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
}
export interface GateState {
  status: TriageStatus;
  /** Reason code recorded with a dismissal in this document. */
  reasonCode?: string | null;
  /** Counsel answer recorded for this finding (current document). */
  counselAnswer?: CounselOption | null;
}
export interface GateReason {
  findingKey: string;
  kind: GateReasonKind;
  link: string;
}
export interface GateResult {
  status: GateStatus;
  reasons: GateReason[];
}

/** `computeGate(findings, states, labels)`: critical-only; AI findings never gate. */
export type ComputeGate = (
  findings: readonly GateFinding[],
  states: Readonly<Record<string, GateState>>,
  labels: Readonly<Record<string, MemoryLabel>>,
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
}
export interface CounselSheet {
  meta: CounselSheetMeta;
  questions: SheetQuestion[];
}
