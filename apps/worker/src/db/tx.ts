// Batch error classification. D1 runs a `db.batch` as one transaction; a constraint or trigger
// failure aborts the whole batch and surfaces as an Error whose message carries the SQLite text.
// The texts below were recorded by spike S8 (local D1, `s08-sql-surface`).

/** UNIQUE (workspace_id, client_op_id) on audit_event: a replayed outbox write. */
export const OP_REPLAY_TEXT =
  'UNIQUE constraint failed: audit_event.workspace_id, audit_event.client_op_id';
/** uq_decision_active: a second active decision for (workspace, firm, fingerprint). */
export const ACTIVE_CONFLICT_TEXT =
  'UNIQUE constraint failed: decision.workspace_id, decision.law_firm_id, decision.fingerprint';
/** RAISE(ABORT, ...) messages from migration 0002. */
export const TRIGGER_TEXTS = [
  'decision_append_only',
  'decision_immutable',
  'audit_append_only',
  'answer_append_only',
  'answer_immutable',
  'rule_immutable',
  'demo_read_only',
] as const;
export type TriggerText = (typeof TRIGGER_TEXTS)[number];

export type BatchFailure =
  | { kind: 'op_replay' }
  | { kind: 'active_conflict' }
  | { kind: 'trigger'; trigger: TriggerText }
  | { kind: 'other' };

export function classifyBatchError(e: unknown): BatchFailure {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes(OP_REPLAY_TEXT)) return { kind: 'op_replay' };
  if (msg.includes(ACTIVE_CONFLICT_TEXT)) return { kind: 'active_conflict' };
  for (const t of TRIGGER_TEXTS) if (msg.includes(t)) return { kind: 'trigger', trigger: t };
  return { kind: 'other' };
}
