// Lookup: ONE query for up to 200 fingerprints via a single json_each parameter (S8). The literal
// `status = 'active'` makes the partial unique index uq_decision_active usable; S8 showed the
// planner otherwise prefers a primary-key prefix scan of the whole workspace, so the index is
// pinned with INDEXED BY (SQLite errors instead of silently scanning if it ever becomes unusable).
import type { ActiveDecision } from '@aduin/core';
import type { Db } from '../../db/meta';
import { DECISION_COLS, toActiveDecision, type DecisionDbRow } from './decision';

export const LOOKUP_SQL = {
  lookup:
    `SELECT ${DECISION_COLS} FROM decision d INDEXED BY uq_decision_active WHERE d.workspace_id = ?1 ` +
    "AND d.law_firm_id = ?2 AND d.status = 'active' AND d.fingerprint IN (SELECT value FROM json_each(?3))",
} as const;

export async function lookupActive(
  db: Db,
  workspaceId: string,
  firm: string,
  fingerprints: readonly string[],
): Promise<ActiveDecision[]> {
  if (fingerprints.length === 0) return [];
  const r = await db
    .prepare(LOOKUP_SQL.lookup)
    .bind(workspaceId, firm, JSON.stringify([...new Set(fingerprints)]))
    .all<DecisionDbRow>();
  return r.results.map(toActiveDecision);
}
