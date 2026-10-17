// Regression checks (Variance Phase 03, migration 0006). Append-only: created inside the counsel
// answer batch, never deleted (purge only) and never edited except the active -> revoked flip.
// Every statement binds BOTH workspace_id (?1, from the cookie) and law_firm_id (?2, from the
// question row), so a lookup can never return another workspace's or another firm's check.
import type { RegressionCheckSummary } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

export const REGRESSION_SQL = {
  insert:
    'INSERT INTO regression_check (workspace_id, id, law_firm_id, source_answer_id, source_fund_name, ' +
    "assertion_kind, assertion_key, statement_text, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'scope_exists', ?6, ?7, 'active', ?8)",
  countActive:
    "SELECT COUNT(*) AS n FROM regression_check WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active'",
  active:
    'SELECT id, assertion_kind, assertion_key, statement_text, source_fund_name FROM regression_check ' +
    "WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active' ORDER BY created_at, id LIMIT ?3",
} as const;

export interface NewRegressionCheck {
  id: string;
  lawFirmId: string;
  sourceAnswerId: string;
  sourceFundName: string;
  assertionKey: string;
  statementText: string;
}

export function insertRegressionCheckStmt(
  db: Db,
  ctx: MemoryCtx,
  c: NewRegressionCheck,
): D1PreparedStatement {
  return db
    .prepare(REGRESSION_SQL.insert)
    .bind(
      ctx.workspaceId,
      c.id,
      c.lawFirmId,
      c.sourceAnswerId,
      c.sourceFundName,
      c.assertionKey,
      c.statementText,
      ctx.now,
    );
}

export async function countActiveChecks(
  ctx: Pick<MemoryCtx, 'db' | 'workspaceId'>,
  firm: string,
): Promise<number> {
  const r = await ctx.db
    .prepare(REGRESSION_SQL.countActive)
    .bind(ctx.workspaceId, firm)
    .first<{ n: number }>();
  return Number(r?.n ?? 0);
}

/** Active checks of ONE workspace and ONE firm, bounded by the per-firm cap. */
export async function activeChecks(
  db: Db,
  workspaceId: string,
  firm: string,
  cap: number,
): Promise<RegressionCheckSummary[]> {
  const r = await db
    .prepare(REGRESSION_SQL.active)
    .bind(workspaceId, firm, cap)
    .all<RegressionCheckSummary>();
  return r.results.map((x) => ({
    id: x.id,
    assertion_kind: 'scope_exists',
    assertion_key: x.assertion_key,
    statement_text: x.statement_text,
    source_fund_name: x.source_fund_name,
  }));
}
