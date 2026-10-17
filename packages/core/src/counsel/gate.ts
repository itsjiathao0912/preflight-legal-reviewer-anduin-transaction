import type { MemoryLabel } from '../contracts/memory';
import type {
  ComputeGate,
  GateFinding,
  GateOwner,
  GateReason,
  GateReasonKind,
  GateState,
  VarianceGatePolicy,
} from './types';

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

export const computeGate: ComputeGate = (findings, states, labels, policy) => {
  if (policy) return computeVarianceGate(findings, states, labels, policy);
  const reasons: GateReason[] = [];
  for (const f of findings) {
    if (!isGating(f)) continue;
    const kind = gateReasonFor(states[f.id] ?? { status: 'open' }, labels[f.id] ?? 'new');
    if (kind) reasons.push({ findingKey: f.id, kind, link: findingLink(f.id) });
  }
  return { status: reasons.length ? 'blocked' : 'ready', reasons };
};

const OWNER_ORDER: readonly GateOwner[] = ['counsel', 'gp', 'fund_admin'];

/** Asked owners (key present) in canonical order. */
function askedOwners(state: GateState): GateOwner[] {
  const oa = state.ownerAnswers;
  return oa ? OWNER_ORDER.filter((o) => Object.prototype.hasOwnProperty.call(oa, o)) : [];
}

/** True when a question was asked and has no clear A/B/C answer yet (unclear counts as open). */
export function askedUnanswered(state: GateState): boolean {
  const owners = askedOwners(state);
  if (owners.length) {
    return owners.some((o) => {
      const a = state.ownerAnswers![o] ?? null;
      return a !== 'A' && a !== 'B' && a !== 'C';
    });
  }
  const answer = state.counselAnswer ?? null;
  if (answer === 'A' || answer === 'B' || answer === 'C') return false;
  return state.status === 'accepted' || state.status === 'counsel' || answer === 'unclear';
}

/**
 * Variance gate (policy on). Per finding, AI never gates. Eligible when: a variance finding
 * (`gates: true`) and its policy flag allows it (critical = regression, else untriaged change), a
 * legacy gating finding (critical, not AI), or an asked question without a clear answer. With
 * asked owners, one reason per owner still open (`unclear` or `awaiting_counsel`); otherwise the
 * legacy reason mapping. Still exactly two states.
 */
function computeVarianceGate(
  findings: readonly GateFinding[],
  states: Readonly<Record<string, GateState>>,
  labels: Readonly<Record<string, MemoryLabel>>,
  policy: VarianceGatePolicy,
) {
  const reasons: GateReason[] = [];
  for (const f of findings) {
    if (f.detector_kind === 'ai') continue;
    const state = states[f.id] ?? { status: 'open' };
    const eligible = f.gates
      ? f.severity === 'critical'
        ? policy.regression_blocks
        : policy.untriaged_change_blocks
      : isGating(f);
    if (!eligible && !(policy.asked_unanswered_blocks && askedUnanswered(state))) continue;
    const owners = askedOwners(state);
    if (owners.length) {
      for (const o of owners) {
        const a = state.ownerAnswers![o] ?? null;
        if (a === 'A' || a === 'B' || a === 'C') continue;
        const kind: GateReasonKind = a === 'unclear' ? 'unclear' : 'awaiting_counsel';
        reasons.push({ findingKey: f.id, kind, link: findingLink(f.id), owner: o });
      }
      continue;
    }
    const kind = gateReasonFor(state, labels[f.id] ?? 'new');
    if (kind) reasons.push({ findingKey: f.id, kind, link: findingLink(f.id) });
  }
  return { status: reasons.length ? ('blocked' as const) : ('ready' as const), reasons };
}

export const GATE_REASON_TEXT: Readonly<Record<GateReasonKind, string>> = Object.freeze({
  open: 'not resolved',
  unanswered: 'accepted, waiting for counsel',
  unclear: 'counsel answered unclear',
  awaiting_counsel: 'waiting for counsel',
  reconfirm_required: 'needs re-confirmation',
});
