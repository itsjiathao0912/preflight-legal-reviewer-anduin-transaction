// Retention purge (D-4, constants from core `limits`). One atomic db.batch: mark at most 50 expired
// sandboxes 'purging' (the only state in which the append-only triggers allow DELETE), set-based
// child-first deletes, then expired ai_cache rows (7 d TTL via expires_at), quota windows older than
// 2 days and old breaker keys. The demo workspace is never purged (kind='demo' has no expires_at,
// and a CHECK keeps it 'active'). The lazy purge is claimed at most once per hour via app_meta.
import { limits } from '@aduin/core';
import type { Db } from '../../db/meta';
import { utcDay } from '../../limits/clock';

export const PURGE_BATCH_WORKSPACES = 50;
export const PURGE_SLOT_MS = 3_600_000;
const DAY_MS = 86_400_000;

const IN_PURGING = "workspace_id IN (SELECT id FROM workspace WHERE status = 'purging')";

/** Child-first order (every child is deleted before the rows it references). */
export const PURGE_CHILD_TABLES = [
  'rule_evidence',
  'finding_state',
  'finding',
  'firm_rule',
  'decision',
  'regression_check',
  'counsel_comment',
  'counsel_answer',
  'counsel_question',
  'review_run',
  'document',
  'fund',
  'audit_event',
  'analyst',
] as const;

export const PURGE_SQL = {
  claimSlot:
    "UPDATE app_meta SET value = CAST(?1 AS TEXT), updated_at = ?1 WHERE key = 'last_purge_at' " +
    'AND CAST(value AS INTEGER) <= ?2 RETURNING value',
  mark:
    "UPDATE workspace SET status = 'purging' WHERE id IN (SELECT id FROM workspace WHERE kind = 'sandbox' " +
    "AND status = 'active' AND expires_at <= ?1 ORDER BY expires_at LIMIT ?2)",
  ...Object.fromEntries(
    PURGE_CHILD_TABLES.map((t) => [`delete_${t}`, `DELETE FROM ${t} WHERE ${IN_PURGING}`]),
  ),
  deleteWorkspaces: "DELETE FROM workspace WHERE status = 'purging' AND kind = 'sandbox'",
  deleteCache:
    'DELETE FROM ai_cache WHERE key IN (SELECT key FROM ai_cache WHERE expires_at <= ?1 LIMIT 500)',
  deleteQuota:
    "DELETE FROM quota_counter WHERE (scope, key, window) IN (SELECT scope, key, window FROM quota_counter WHERE window <> 'all' AND window < ?1 LIMIT 1000)",
  deleteBreaker: "DELETE FROM app_meta WHERE key LIKE 'breaker:%' AND key < ?1",
  countPurging: "SELECT COUNT(*) AS n FROM workspace WHERE status = 'purging'",
} as const as Record<string, string>;

/** Statements that are global by design (no workspace_id column on the target). */
export const PURGE_GLOBAL_SQL = [
  'claimSlot',
  'mark',
  'deleteWorkspaces',
  'deleteCache',
  'deleteQuota',
  'deleteBreaker',
  'countPurging',
] as const;

export interface PurgeResult {
  workspaces: number;
  cacheRows: number;
  quotaRows: number;
}

/** Claim the lazy purge slot (at most once per hour). */
export async function claimPurgeSlot(db: Db, now: number): Promise<boolean> {
  const r = await db
    .prepare(PURGE_SQL.claimSlot!)
    .bind(now, now - PURGE_SLOT_MS)
    .first();
  return r !== null;
}

export async function runPurge(db: Db, now: number): Promise<PurgeResult> {
  const quotaCutoff = utcDay(now - limits.quotaWindowPurgeDays * DAY_MS);
  const stmts: D1PreparedStatement[] = [
    db.prepare(PURGE_SQL.mark!).bind(now, PURGE_BATCH_WORKSPACES),
    ...PURGE_CHILD_TABLES.map((t) => db.prepare(PURGE_SQL[`delete_${t}`]!)),
    db.prepare(PURGE_SQL.deleteWorkspaces!),
    db.prepare(PURGE_SQL.deleteCache!).bind(now),
    db.prepare(PURGE_SQL.deleteQuota!).bind(quotaCutoff),
    db.prepare(PURGE_SQL.deleteBreaker!).bind(`breaker:${quotaCutoff}`),
  ];
  const r = await db.batch(stmts);
  const changes = (i: number) => Number(r[i]?.meta.changes ?? 0);
  return {
    workspaces: changes(0),
    cacheRows: changes(stmts.length - 3),
    quotaRows: changes(stmts.length - 2),
  };
}

/** Sandbox expiry: created_at + 30 days (D-4); a sliding rule may only extend, never shorten. */
export function sandboxExpiry(createdAt: number): number {
  return createdAt + limits.sandboxRetentionDays * DAY_MS;
}
