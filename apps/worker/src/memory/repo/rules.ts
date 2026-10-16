// Firm rules repository. A0 mapping: DB `proposed` origin -> contract `proposal`; `seed_of` set ->
// `seed`; DB `revoked` rules are excluded from lists (the revoke action reports `rejected`, the
// contract's only terminal inactive state).
import type { Rule } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

const RULE_COLS =
  'r.id, r.rule_text, r.status, r.origin, r.seed_of, ' +
  '(SELECT COUNT(*) FROM rule_evidence e WHERE e.workspace_id = r.workspace_id AND e.rule_id = r.id) AS evidence_count';

export const RULES_SQL = {
  listForFirm:
    `SELECT ${RULE_COLS} FROM firm_rule r WHERE r.workspace_id = ?1 AND r.law_firm_id = ?2 ` +
    "AND r.status <> 'revoked' ORDER BY r.created_at, r.id",
  byId: `SELECT ${RULE_COLS}, r.law_firm_id FROM firm_rule r WHERE r.workspace_id = ?1 AND r.id = ?2`,
  insertManual:
    'INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, created_by_name, created_at, ' +
    "decided_by_name, decided_at) VALUES (?1, ?2, ?3, 'manual', 'active', ?4, ?5, ?6, ?5, ?6)",
  approve:
    "UPDATE firm_rule SET status = 'active', rule_text = COALESCE(?3, rule_text), decided_by_name = ?4, decided_at = ?5 " +
    "WHERE workspace_id = ?1 AND id = ?2 AND status = 'proposed'",
  reject:
    "UPDATE firm_rule SET status = 'rejected', decided_by_name = ?3, decided_at = ?4 " +
    "WHERE workspace_id = ?1 AND id = ?2 AND status = 'proposed'",
  revoke:
    "UPDATE firm_rule SET status = 'revoked', revoked_by_name = ?3, revoked_at = ?4, revoke_reason = ?5 " +
    "WHERE workspace_id = ?1 AND id = ?2 AND status = 'active'",
} as const;

export interface RuleDbRow {
  id: string;
  rule_text: string;
  status: 'proposed' | 'active' | 'rejected' | 'revoked';
  origin: 'manual' | 'proposed';
  seed_of: string | null;
  evidence_count: number;
  law_firm_id?: string;
}

export function toRule(r: RuleDbRow): Rule {
  return {
    id: r.id,
    text: r.rule_text,
    status: r.status === 'revoked' ? 'rejected' : r.status,
    origin: r.seed_of !== null ? 'seed' : r.origin === 'proposed' ? 'proposal' : 'manual',
    evidence_count: Number(r.evidence_count),
  };
}

export async function rulesForFirm(db: Db, workspaceId: string, firm: string): Promise<Rule[]> {
  const r = await db.prepare(RULES_SQL.listForFirm).bind(workspaceId, firm).all<RuleDbRow>();
  return r.results.map(toRule);
}

export async function ruleById(ctx: MemoryCtx, id: string): Promise<RuleDbRow | null> {
  return ctx.db.prepare(RULES_SQL.byId).bind(ctx.workspaceId, id).first<RuleDbRow>();
}
