// Workspace + analyst repository. Sandboxes only; the demo workspace is written by the seed alone.
import { limits } from '@aduin/core';
import type { Db } from '../../db/meta';

export const WORKSPACE_SQL = {
  liveness:
    'SELECT w.kind, w.status, w.expires_at, a.display_name, ' +
    "(SELECT value FROM app_meta WHERE key = 'schema_version') AS schema_version, " +
    "(SELECT value FROM app_meta WHERE key = 'seed_mode') AS seed_mode " +
    'FROM workspace w JOIN analyst a ON a.workspace_id = w.id AND a.id = ?2 WHERE w.id = ?1',
  insertSandbox:
    'INSERT INTO workspace (id, kind, status, seed_version, created_at, last_active_at, expires_at) ' +
    "VALUES (?1, 'sandbox', 'active', (SELECT CAST(value AS INTEGER) FROM app_meta WHERE key = 'seed_version'), ?2, ?2, ?3)",
  /** Counsel share (19-10-26): the live sandbox expiry for the share link cap. */
  expiry:
    "SELECT w.expires_at FROM workspace w WHERE w.id = ?1 AND w.kind = 'sandbox' AND w.status = 'active'",
  insertAnalyst:
    'INSERT INTO analyst (workspace_id, id, display_name, is_seed, created_at) VALUES (?1, ?2, ?3, 0, ?4)',
} as const;

/** `workspace` itself is keyed by `id` (the workspace id); the lint treats `w.id = ?1` as scoped. */
export const WORKSPACE_ID_SCOPED = ['liveness', 'insertSandbox', 'expiry'] as const;

export interface LivenessRow {
  kind: 'demo' | 'sandbox';
  status: 'active' | 'purging';
  expires_at: number | null;
  display_name: string;
  schema_version: string | null;
  seed_mode: string | null;
}

export const RETENTION_MS = limits.sandboxRetentionDays * 86_400_000;

export function createSandboxStmts(
  db: Db,
  p: {
    workspaceId: string;
    analystId: string;
    analystName: string;
    now: number;
    expiresAt: number;
  },
): D1PreparedStatement[] {
  return [
    db.prepare(WORKSPACE_SQL.insertSandbox).bind(p.workspaceId, p.now, p.expiresAt),
    db.prepare(WORKSPACE_SQL.insertAnalyst).bind(p.workspaceId, p.analystId, p.analystName, p.now),
  ];
}
