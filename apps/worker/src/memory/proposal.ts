// Rule proposal on write (AC53, D-5), inside the dismissal batch. A proposal is created when at
// least `limits.ruleProposalMin` (3) DISTINCT ACTIVE dismissals share (workspace, firm,
// pattern_key, reason_code), reason != 'other', and no live (proposed|active) rule holds the key.
// D-5: a rejected/revoked key is re-proposed only on NEW evidence: at least one active same-key
// dismissal decided after the latest rejection/revocation, while the total is still >= 3.
import { limits, type ReasonCode } from '@aduin/core';
import { newId } from '../db/ids';
import type { Db } from '../db/meta';
import type { MemoryCtx } from './ctx';
import { AUDIT_SQL, auditStmt } from './repo/audit';

const SAME_KEY =
  "workspace_id = ?1 AND law_firm_id = ?3 AND pattern_key = ?8 AND reason_code = ?9 AND decision = 'dismissed' AND status = 'active'";
const KEY_RULES = 'workspace_id = ?1 AND law_firm_id = ?3 AND proposal_key = ?5';

/**
 * Review fix cycle 3 (N7): the evidence insert links at most the newest EVIDENCE_LINK_MAX active
 * same-key dismissals per dismissal, so the decision write weight is a real upper bound (a
 * reject -> dismiss loop over hundreds of same-key dismissals used to write one row per
 * dismissal). The proposal threshold uses COUNT(*) over decisions, so it is unaffected; evidence is
 * display/provenance only. `evidence_count` therefore counts LINKED evidence: a re-proposal after a
 * rejection links at most the newest 10, and every later same-key dismissal adds itself.
 */
export const EVIDENCE_LINK_MAX = 10;

export const PROPOSAL_SQL = {
  propose:
    'INSERT INTO firm_rule (workspace_id, id, law_firm_id, origin, status, rule_text, proposal_key, created_by_name, created_at) ' +
    "SELECT ?1, ?2, ?3, 'proposed', 'proposed', ?4, ?5, ?6, ?7 " +
    `WHERE (SELECT COUNT(*) FROM decision WHERE ${SAME_KEY}) >= ?10 ` +
    `AND NOT EXISTS (SELECT 1 FROM firm_rule WHERE ${KEY_RULES} AND status IN ('proposed','active')) ` +
    `AND (NOT EXISTS (SELECT 1 FROM firm_rule WHERE ${KEY_RULES} AND status IN ('rejected','revoked')) ` +
    `OR EXISTS (SELECT 1 FROM decision WHERE ${SAME_KEY} AND decided_at > ` +
    `(SELECT MAX(COALESCE(revoked_at, decided_at, created_at)) FROM firm_rule WHERE ${KEY_RULES} AND status IN ('rejected','revoked'))))`,
  evidence:
    'INSERT OR IGNORE INTO rule_evidence (workspace_id, rule_id, decision_id, added_at) ' +
    'SELECT ?1, r.id, d.id, ?6 FROM firm_rule r JOIN decision d ON d.workspace_id = r.workspace_id AND d.law_firm_id = r.law_firm_id ' +
    "WHERE r.workspace_id = ?1 AND r.law_firm_id = ?2 AND r.proposal_key = ?3 AND r.status = 'proposed' " +
    "AND d.pattern_key = ?4 AND d.reason_code = ?5 AND d.decision = 'dismissed' AND d.status = 'active' " +
    `ORDER BY d.decided_at DESC, d.id DESC LIMIT ${EVIDENCE_LINK_MAX}`,
} as const;

const REASON_TEXT: Record<Exclude<ReasonCode, 'other'>, string> = {
  firm_standard_wording: 'standard wording for this firm',
  no_form_impact: 'no impact on the digital form',
  tool_false_alarm: 'a tool false alarm',
};

export const proposalKey = (patternKey: string, reason: string) => `${patternKey}|${reason}`;

export function proposalText(patternKey: string, reason: Exclude<ReasonCode, 'other'>): string {
  return `Findings matching "${patternKey}" are usually ${REASON_TEXT[reason]} (proposed from repeated dismissals).`;
}

/** Statements appended to the dismissal batch; [] when the dismissal can never propose. */
export function proposalStmts(
  db: Db,
  ctx: MemoryCtx,
  p: { firm: string; patternKey: string | null; reason: ReasonCode | null; op: string },
): D1PreparedStatement[] {
  if (!p.patternKey || !p.reason || p.reason === 'other') return [];
  const key = proposalKey(p.patternKey, p.reason);
  const ruleId = newId('fr', ctx.now);
  return [
    db
      .prepare(PROPOSAL_SQL.propose)
      .bind(
        ctx.workspaceId,
        ruleId,
        p.firm,
        proposalText(p.patternKey, p.reason),
        key,
        ctx.analystName,
        ctx.now,
        p.patternKey,
        p.reason,
        limits.ruleProposalMin,
      ),
    db
      .prepare(PROPOSAL_SQL.evidence)
      .bind(ctx.workspaceId, p.firm, key, p.patternKey, p.reason, ctx.now),
    auditStmt(
      db,
      ctx,
      {
        op: `${p.op}:rp`,
        action: 'rule_proposed',
        lawFirmId: p.firm,
        entityType: 'rule',
        entityId: ruleId,
        detail: { reason_code: p.reason },
      },
      AUDIT_SQL.insertIfRuleExists,
    ),
  ];
}
