import type { CounselOption, MemoryLabel, Severity } from '@aduin/core';

/**
 * Interim gate rule (Phase 03). Pure. Its shape mirrors Phase 08 `computeGate(findings, states, labels)`
 * so P08 swaps this import for core.
 *
 * A critical finding is unresolved until it is dismissed with a reason or answered by counsel (A/B/C).
 * Accept alone keeps the gate Blocked (`unanswered`); Needs counsel -> `awaiting_counsel`;
 * `dismissed_reconfirm` stays unresolved (`reconfirm_required`) until re-confirmed in this document,
 * and (D-2) a counsel answer A/B/C on it counts as the re-confirmation; answer `unclear` stays unresolved.
 * Non-critical findings never block.
 */
export type TriageStatus = 'open' | 'accepted' | 'counsel' | 'dismissed';
export type GateReasonKind =
  'open' | 'unanswered' | 'unclear' | 'awaiting_counsel' | 'reconfirm_required';

export interface GateFinding {
  /** Finding key (engine-stable id). */
  id: string;
  severity: Severity;
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
  status: 'ready' | 'blocked';
  reasons: GateReason[];
}

function reasonFor(state: GateState, label: MemoryLabel): GateReasonKind | null {
  const answer = state.counselAnswer ?? null;
  if (answer === 'A' || answer === 'B' || answer === 'C') return null;
  if (answer === 'unclear') return 'unclear';
  if (state.status === 'dismissed') return state.reasonCode ? null : 'open';
  if (state.status === 'accepted') return 'unanswered';
  if (state.status === 'counsel') return 'awaiting_counsel';
  // status open: prior memory decides
  switch (label) {
    case 'dismissed_reconfirm':
      return 'reconfirm_required';
    case 'already_answered':
      return null;
    case 'awaiting_counsel':
      return 'awaiting_counsel';
    case 'previously_dismissed':
    case 'new':
      return 'open';
  }
}

export function gateInterim(
  findings: readonly GateFinding[],
  states: Readonly<Record<string, GateState>>,
  labels: Readonly<Record<string, MemoryLabel>>,
): GateResult {
  const reasons: GateReason[] = [];
  for (const f of findings) {
    if (f.severity !== 'critical') continue;
    const kind = reasonFor(states[f.id] ?? { status: 'open' }, labels[f.id] ?? 'new');
    if (kind) reasons.push({ findingKey: f.id, kind, link: `#findings/${f.id}` });
  }
  return { status: reasons.length ? 'blocked' : 'ready', reasons };
}

export const GATE_REASON_TEXT: Readonly<Record<GateReasonKind, string>> = Object.freeze({
  open: 'not resolved',
  unanswered: 'accepted, waiting for counsel',
  unclear: 'counsel answered unclear',
  awaiting_counsel: 'waiting for counsel',
  reconfirm_required: 'needs re-confirmation',
});
