// Sandbox creation copies the demo seed (copy-on-write at creation, AC57): INSERT ... SELECT from
// ws_demo with ids `${sandboxId}:${seedId}` and `seed_of` set, so rule evidence maps without an id
// table and memory never crosses workspaces. Nobody ever holds a cookie bound to ws_demo.
import type { Db } from '../db/meta';
import { DEMO_WORKSPACE_ID } from './health';

const MAP = (col: string) => `CASE WHEN ${col} IS NULL THEN NULL ELSE ?1 || ':' || ${col} END`;

export const SEED_COPY_SQL = {
  analysts:
    'INSERT INTO analyst (workspace_id, id, display_name, is_seed, created_at) ' +
    `SELECT ?1, ?1 || ':' || id, display_name, 1, ?2 FROM analyst WHERE workspace_id = '${DEMO_WORKSPACE_ID}'`,
  decisions:
    'INSERT INTO decision (workspace_id, id, law_firm_id, fingerprint, fp_version, issue_class, pattern_key, quote_hash, ' +
    'quote_snippet, section_path, fund_name, doc_version_label, decision, reason_code, note, counsel_option, counsel_note, ' +
    'decided_by_analyst_id, decided_by_name, decided_at, status, supersedes_id, superseded_by_id, revoked_by_name, ' +
    'revoked_at, revoke_reason, seed_of) ' +
    "SELECT ?1, ?1 || ':' || id, law_firm_id, fingerprint, fp_version, issue_class, pattern_key, quote_hash, quote_snippet, " +
    'section_path, fund_name, doc_version_label, decision, reason_code, note, counsel_option, counsel_note, ' +
    `${MAP('decided_by_analyst_id')}, decided_by_name, decided_at, status, ${MAP('supersedes_id')}, ` +
    `${MAP('superseded_by_id')}, revoked_by_name, revoked_at, revoke_reason, id ` +
    `FROM decision WHERE workspace_id = '${DEMO_WORKSPACE_ID}' AND counsel_answer_id IS NULL`,
  rules:
    'INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, proposal_key, created_by_name, ' +
    'created_at, decided_by_name, decided_at, revoked_by_name, revoked_at, revoke_reason, seed_of) ' +
    "SELECT ?1, ?1 || ':' || id, law_firm_id, origin, status, rule_text, proposal_key, created_by_name, created_at, " +
    `decided_by_name, decided_at, revoked_by_name, revoked_at, revoke_reason, id FROM firm_rule WHERE workspace_id = '${DEMO_WORKSPACE_ID}'`,
  evidence:
    'INSERT INTO rule_evidence (workspace_id, rule_id, decision_id, added_at) ' +
    "SELECT ?1, ?1 || ':' || e.rule_id, ?1 || ':' || e.decision_id, e.added_at FROM rule_evidence e " +
    `JOIN decision d ON d.workspace_id = e.workspace_id AND d.id = e.decision_id WHERE e.workspace_id = '${DEMO_WORKSPACE_ID}' ` +
    'AND d.counsel_answer_id IS NULL',
  audit:
    'INSERT INTO audit_event (workspace_id, id, client_op_id, at, analyst_id, actor_name, action, law_firm_id, ' +
    'entity_type, entity_id, reason, detail_json) ' +
    `SELECT ?1, ?1 || ':' || id, client_op_id, at, ${MAP('analyst_id')}, actor_name, action, law_firm_id, entity_type, ` +
    `${MAP('entity_id')}, reason, detail_json FROM audit_event WHERE workspace_id = '${DEMO_WORKSPACE_ID}'`,
} as const;

export function seedCopyStmts(db: Db, sandboxId: string, now: number): D1PreparedStatement[] {
  return [
    db.prepare(SEED_COPY_SQL.analysts).bind(sandboxId, now),
    db.prepare(SEED_COPY_SQL.decisions).bind(sandboxId),
    db.prepare(SEED_COPY_SQL.rules).bind(sandboxId),
    db.prepare(SEED_COPY_SQL.evidence).bind(sandboxId),
    db.prepare(SEED_COPY_SQL.audit).bind(sandboxId),
  ];
}
