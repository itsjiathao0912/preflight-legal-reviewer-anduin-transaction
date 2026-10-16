// Audit repository. Every write batch inserts exactly one audit_event FIRST; its
// UNIQUE (workspace_id, client_op_id) makes outbox retries idempotent: a replay aborts the batch
// and the ORIGINAL result (stored in result_json) is returned with 200. detail_json carries ids
// and enums only (never free text).
import { AUDIT_ACTIONS, type AuditEvent } from '@aduin/core';
import { newId } from '../../db/ids';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

const COLS =
  'workspace_id, id, client_op_id, at, analyst_id, actor_name, action, law_firm_id, entity_type, entity_id, reason, detail_json, result_json';

export const AUDIT_SQL = {
  insert: `INSERT INTO audit_event (${COLS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
  insertIfDecisionActive:
    `INSERT INTO audit_event (${COLS}) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13 ` +
    "WHERE EXISTS (SELECT 1 FROM decision WHERE workspace_id = ?1 AND id = ?10 AND status = 'active')",
  insertIfRuleExists:
    `INSERT INTO audit_event (${COLS}) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13 ` +
    'WHERE EXISTS (SELECT 1 FROM firm_rule WHERE workspace_id = ?1 AND id = ?10)',
  byOp: 'SELECT action, result_json FROM audit_event WHERE workspace_id = ?1 AND client_op_id = ?2',
  page:
    'SELECT id, at, actor_name, action, law_firm_id, entity_type, entity_id, reason, detail_json FROM audit_event ' +
    'WHERE workspace_id = ?1 AND (?2 IS NULL OR at < ?2 OR (at = ?2 AND id < ?3)) ORDER BY at DESC, id DESC LIMIT ?4',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditInput {
  op: string;
  action: AuditAction;
  lawFirmId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  reason?: string | null;
  /** ids and enums only */
  detail?: Record<string, string | number | boolean | null>;
  result?: unknown;
}

export function auditStmt(
  db: Db,
  ctx: MemoryCtx,
  a: AuditInput,
  sql: string = AUDIT_SQL.insert,
): D1PreparedStatement {
  return db
    .prepare(sql)
    .bind(
      ctx.workspaceId,
      newId('ae', ctx.now),
      a.op,
      ctx.now,
      ctx.analystId,
      ctx.analystName,
      a.action,
      a.lawFirmId ?? null,
      a.entityType ?? null,
      a.entityId ?? null,
      a.reason ?? null,
      a.detail ? JSON.stringify(a.detail) : null,
      a.result === undefined ? null : JSON.stringify(a.result),
    );
}

/** The stored original result for a replayed client_op_id (or null). */
export async function replayed(
  ctx: MemoryCtx,
  op: string,
): Promise<{ action: string; result: unknown } | null> {
  const row = await ctx.db
    .prepare(AUDIT_SQL.byOp)
    .bind(ctx.workspaceId, op)
    .first<{ action: string; result_json: string | null }>();
  if (!row) return null;
  const parse = (t: string | null): unknown => {
    if (t === null) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };
  return { action: row.action, result: parse(row.result_json) };
}

interface AuditRow {
  id: string;
  at: number;
  actor_name: string;
  action: string;
  law_firm_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  reason: string | null;
  detail_json: string | null;
}

const ACTIONS = new Set<string>(AUDIT_ACTIONS);

function toEvent(r: AuditRow): AuditEvent | null {
  if (!ACTIONS.has(r.action)) return null;
  let detail: Record<string, unknown> | undefined;
  if (r.detail_json) {
    try {
      const v: unknown = JSON.parse(r.detail_json);
      if (v && typeof v === 'object' && !Array.isArray(v)) detail = v as Record<string, unknown>;
    } catch {
      detail = undefined;
    }
  }
  return {
    id: r.id,
    at: r.at,
    actor_name: r.actor_name,
    action: r.action as AuditAction,
    ...(r.law_firm_id ? { law_firm_id: r.law_firm_id } : {}),
    ...(r.entity_type ? { entity_type: r.entity_type } : {}),
    ...(r.entity_id ? { entity_id: r.entity_id } : {}),
    ...(r.reason ? { reason: r.reason } : {}),
    ...(detail ? { detail } : {}),
  };
}

export async function auditPage(
  ctx: MemoryCtx,
  limit: number,
  cursor: { at: number; id: string } | null,
): Promise<{ events: AuditEvent[]; next: { at: number; id: string } | null }> {
  const r = await ctx.db
    .prepare(AUDIT_SQL.page)
    .bind(ctx.workspaceId, cursor?.at ?? null, cursor?.id ?? '', limit + 1)
    .all<AuditRow>();
  const rows = r.results.slice(0, limit);
  const last = rows.at(-1);
  return {
    events: rows.map(toEvent).filter((e): e is AuditEvent => e !== null),
    next: r.results.length > limit && last ? { at: last.at, id: last.id } : null,
  };
}
