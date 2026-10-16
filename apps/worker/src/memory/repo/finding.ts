// Findings (best-effort tier) and finding_state (working state). Multi-row insert through ONE
// json_each parameter (never one INSERT per finding). Privacy (R1): `detail.facts` and
// `detail.explanation` are never persisted (detail_json stays NULL); snippets are re-masked.
import { type FindingWire, type MemoryLabel } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';
import { maskFree, snippetOf } from '../mask';

export const FINDING_SQL = {
  insertMany:
    'INSERT OR IGNORE INTO finding (workspace_id, review_run_id, finding_key, issue_class, pattern_key, severity, ' +
    'detector_kind, detector_id, model, provenance, confidence, anchor, section_path, page, region_json, ' +
    'quote_snippet, quote_hash, fingerprint, detail_json, memory_label, matched_decision_id, created_at) ' +
    "SELECT ?1, ?2, json_extract(value, '$.k'), json_extract(value, '$.c'), json_extract(value, '$.pk'), " +
    "json_extract(value, '$.s'), json_extract(value, '$.dk'), json_extract(value, '$.di'), json_extract(value, '$.m'), " +
    "json_extract(value, '$.pv'), json_extract(value, '$.cf'), json_extract(value, '$.a'), json_extract(value, '$.sp'), " +
    "json_extract(value, '$.pg'), json_extract(value, '$.rg'), json_extract(value, '$.q'), json_extract(value, '$.qh'), " +
    "json_extract(value, '$.fp'), NULL, json_extract(value, '$.l'), json_extract(value, '$.md'), ?3 FROM json_each(?4)",
  recount:
    'UPDATE review_run SET findings_total = (SELECT COUNT(*) FROM finding WHERE workspace_id = ?1 AND review_run_id = ?2), ' +
    "blocking_total = (SELECT COUNT(*) FROM finding WHERE workspace_id = ?1 AND review_run_id = ?2 AND severity IN ('critical','high')) " +
    'WHERE workspace_id = ?1 AND id = ?2',
  upsertState:
    'INSERT INTO finding_state (workspace_id, review_run_id, finding_key, status, needs_counsel, current_decision_id, ' +
    'updated_by_name, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ' +
    'ON CONFLICT(workspace_id, review_run_id, finding_key) DO UPDATE SET status = excluded.status, ' +
    'needs_counsel = excluded.needs_counsel, current_decision_id = excluded.current_decision_id, ' +
    'updated_by_name = excluded.updated_by_name, updated_at = excluded.updated_at',
  reopenState:
    "UPDATE finding_state SET status = 'open', current_decision_id = NULL, updated_by_name = ?3, updated_at = ?4 " +
    'WHERE workspace_id = ?1 AND current_decision_id = ?2',
} as const;

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Compact, privacy-safe JSON row for the json_each insert. */
export function findingRow(
  f: FindingWire,
  label: MemoryLabel,
  matchedDecisionId: string | null,
): Record<string, unknown> {
  const anchor = JSON.stringify({
    docHash: f.anchor.docHash.slice(0, 64),
    blockId: maskFree(f.anchor.blockId).slice(0, 200),
    offsetStart: f.anchor.offsetStart,
    offsetEnd: f.anchor.offsetEnd,
  });
  return {
    k: f.id,
    c: f.issue_class,
    pk: f.pattern_key ?? null,
    s: f.severity,
    dk: f.detector_kind,
    di: maskFree(f.detector_id),
    m: f.model === undefined || f.model === null ? null : maskFree(f.model),
    pv: f.provenance ?? null,
    cf: f.confidence,
    a: anchor,
    sp: f.section_path.length ? JSON.stringify(f.section_path.map(maskFree)) : null,
    pg: f.page ?? null,
    rg: f.region
      ? JSON.stringify({
          x: round4(f.region.x),
          y: round4(f.region.y),
          w: round4(f.region.w),
          h: round4(f.region.h),
        })
      : null,
    q: snippetOf(f.quote_snippet),
    qh: f.quote_hash,
    fp: f.fingerprint,
    l: label,
    md: matchedDecisionId,
    // NOTE: f.detail (explanation, facts, interpretations) is intentionally NOT copied (R1).
  };
}

export function insertFindingsStmts(
  db: Db,
  ctx: MemoryCtx,
  runId: string,
  rows: Record<string, unknown>[],
): D1PreparedStatement[] {
  return [
    db.prepare(FINDING_SQL.insertMany).bind(ctx.workspaceId, runId, ctx.now, JSON.stringify(rows)),
    db.prepare(FINDING_SQL.recount).bind(ctx.workspaceId, runId),
  ];
}

export function upsertStateStmt(
  db: Db,
  ctx: MemoryCtx,
  p: {
    runId: string;
    findingKey: string;
    status: 'open' | 'accepted' | 'dismissed' | 'answered';
    needsCounsel: boolean;
    decisionId: string | null;
  },
): D1PreparedStatement {
  return db
    .prepare(FINDING_SQL.upsertState)
    .bind(
      ctx.workspaceId,
      p.runId,
      p.findingKey,
      p.status,
      p.needsCounsel ? 1 : 0,
      p.decisionId,
      ctx.analystName,
      ctx.now,
    );
}

export function reopenStateStmt(db: Db, ctx: MemoryCtx, decisionId: string): D1PreparedStatement {
  return db
    .prepare(FINDING_SQL.reopenState)
    .bind(ctx.workspaceId, decisionId, ctx.analystName, ctx.now);
}
