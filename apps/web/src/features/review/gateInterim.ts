/**
 * Phase 08: the interim Phase 03 gate is now the strict core gate (`computeGate` in
 * packages/core/src/counsel/gate.ts). This file stays a thin re-export with the names it exported
 * before (E13), so no importer changes: critical-only, AI-detector findings never gate (L4),
 * Accept alone = `unanswered`, a clear A/B/C counsel answer resolves (D-2 also re-confirms),
 * `unclear` stays unresolved, a dismissal resolves only with a reason code.
 */
export { computeGate as gateInterim, GATE_REASON_TEXT } from '@aduin/core';
export type {
  TriageStatus,
  GateReasonKind,
  GateFinding,
  GateState,
  GateReason,
  GateResult,
} from '@aduin/core';
