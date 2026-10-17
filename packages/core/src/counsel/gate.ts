import type { MemoryLabel } from '../contracts/memory';
import type { ComputeGate, GateFinding, GateReason, GateReasonKind, GateState } from './types';

/**
 * Strict counsel gate (Phase 08, AC22). Pure.
 *
 * - Critical-only: high and lower never gate (a high `dismissed_reconfirm` keeps its label in the UI
 *   but does not gate).
 * - L4: a finding with `detector_kind === 'ai'` never gates, whatever its status or label.
 * - Accept alone = `unanswered` (Blocked until counsel answers); Needs counsel = `awaiting_counsel`;
 *   counsel `unclear` = `unclear`; a clear A/B/C answer resolves (D-2: also re-confirms a
 *   `dismissed_reconfirm` finding); a dismissal resolves only with a reason code.
 */
export function gateReasonFor(state: GateState, label: MemoryLabel): GateReasonKind | null {
  const answer = state.counselAnswer ?? null;
  if (answer === 'A' || answer === 'B' || answer === 'C') return null;
  if (answer === 'unclear') return 'unclear';
  if (state.status === 'dismissed') return state.reasonCode ? null : 'open';
  if (state.status === 'accepted') return 'unanswered';
  if (state.status === 'counsel') return 'awaiting_counsel';
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

/** True when this finding can gate at all (critical and not AI-detected). */
export function isGating(f: GateFinding): boolean {
  return f.severity === 'critical' && f.detector_kind !== 'ai';
}

export function findingLink(findingKey: string): string {
  return `#findings/${findingKey}`;
}

export const computeGate: ComputeGate = (findings, states, labels) => {
  const reasons: GateReason[] = [];
  for (const f of findings) {
    if (!isGating(f)) continue;
    const kind = gateReasonFor(states[f.id] ?? { status: 'open' }, labels[f.id] ?? 'new');
    if (kind) reasons.push({ findingKey: f.id, kind, link: findingLink(f.id) });
  }
  return { status: reasons.length ? 'blocked' : 'ready', reasons };
};

export const GATE_REASON_TEXT: Readonly<Record<GateReasonKind, string>> = Object.freeze({
  open: 'not resolved',
  unanswered: 'accepted, waiting for counsel',
  unclear: 'counsel answered unclear',
  awaiting_counsel: 'waiting for counsel',
  reconfirm_required: 'needs re-confirmation',
});
