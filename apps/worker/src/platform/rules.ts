// Workspace-bound RulesPort (AC47, AC51 hand-off to Phase 05). Built per request from the verified
// cookie `w`; only `status='active'` rules reach AI context; `proposed` rules never do.
// No unscoped rules read is exported from this module.
import { rulesHash, type RulesPort } from '@aduin/core';
import type { Db } from '../db/meta';

export const RULES_PORT_SQL = {
  active:
    "SELECT rule_text FROM firm_rule WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active' ORDER BY id",
} as const;

export function createRulesPort(db: Db, workspaceId: string): RulesPort {
  if (!workspaceId) throw new Error('createRulesPort requires a workspace id');
  return {
    async activeRules(law_firm_id) {
      const r = await db
        .prepare(RULES_PORT_SQL.active)
        .bind(workspaceId, law_firm_id)
        .all<{ rule_text: string }>();
      const texts = r.results.map((x) => x.rule_text);
      return { texts, rules_hash: rulesHash(texts) };
    },
  };
}
