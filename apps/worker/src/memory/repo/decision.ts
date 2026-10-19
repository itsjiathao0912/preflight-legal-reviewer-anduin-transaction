// Decision repository (append-only memory). Every statement binds workspace_id (?1).
import type { ActiveDecision } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

export const DECISION_COLS =
  'd.id, d.law_firm_id, d.fingerprint, d.status, d.decision, d.reason_code, d.note, d.counsel_option, ' +
  'd.counsel_note, d.issue_class, d.quote_snippet, d.section_path, d.pattern_key, d.fund_name, ' +
  'd.doc_version_label, d.intent, d.scope, d.decided_by_name, d.decided_at';

export const DECISION_SQL = {
  byId: `SELECT ${DECISION_COLS} FROM decision d WHERE d.workspace_id = ?1 AND d.id = ?2`,
  currentActive:
    `SELECT ${DECISION_COLS} FROM decision d INDEXED BY uq_decision_active WHERE d.workspace_id = ?1 ` +
    "AND d.law_firm_id = ?2 AND d.fingerprint = ?3 AND d.status = 'active'",
  /** Counsel sheet (19-10-26): workspace ACTIVE decisions, newest first, capped. */
  listActive:
    `SELECT ${DECISION_COLS} FROM decision d WHERE d.workspace_id = ?1 AND d.status = 'active' ` +
    'ORDER BY d.decided_at DESC, d.id LIMIT 500',
  supersede:
    "UPDATE decision SET status = 'superseded', superseded_by_id = ?3 WHERE workspace_id = ?1 AND id = ?2 AND status = 'active'",
  revoke:
    "UPDATE decision SET status = 'revoked', revoked_by_name = ?3, revoked_at = ?4, revoke_reason = ?5 " +
    "WHERE workspace_id = ?1 AND id = ?2 AND status = 'active'",
  insert:
    'INSERT INTO decision (workspace_id, id, law_firm_id, fingerprint, fp_version, issue_class, pattern_key, ' +
    'quote_hash, quote_snippet, section_path, fund_name, doc_version_label, origin_fund_id, origin_document_id, ' +
    'origin_review_run_id, origin_finding_key, decision, reason_code, note, counsel_option, counsel_note, ' +
    'counsel_answer_id, decided_by_analyst_id, decided_by_name, decided_at, status, supersedes_id, intent, scope) VALUES ' +
    "(?1, ?2, ?3, ?4, 1, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, 'active', ?25, ?26, ?27)",
} as const;

export interface DecisionDbRow {
  id: string;
  law_firm_id: string;
  fingerprint: string;
  status: ActiveDecision['status'];
  decision: ActiveDecision['decision'];
  reason_code: ActiveDecision['reason_code'] | null;
  note: string | null;
  counsel_option: ActiveDecision['counsel_option'] | null;
  counsel_note: string | null;
  issue_class: ActiveDecision['issue_class'] | null;
  quote_snippet: string | null;
  section_path: string | null;
  pattern_key: string | null;
  fund_name: string;
  doc_version_label: string | null;
  /** Variance (0006); absent on rows selected by pre-0006 column lists. */
  intent?: string | null;
  scope?: ActiveDecision['scope'] | null;
  decided_by_name: string;
  decided_at: number;
}

function sectionPath(json: string | null): string[] | undefined {
  if (!json) return undefined;
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
  } catch {
    return undefined;
  }
}

/** DB row -> frozen ActiveDecision (null columns omitted). */
export function toActiveDecision(r: DecisionDbRow): ActiveDecision {
  const sp = sectionPath(r.section_path);
  return {
    id: r.id,
    fingerprint: r.fingerprint,
    status: r.status,
    decision: r.decision,
    ...(r.reason_code ? { reason_code: r.reason_code } : {}),
    ...(r.note !== null ? { note: r.note } : {}),
    ...(r.counsel_option ? { counsel_option: r.counsel_option } : {}),
    ...(r.counsel_note !== null ? { counsel_note: r.counsel_note } : {}),
    ...(r.issue_class ? { issue_class: r.issue_class } : {}),
    ...(r.quote_snippet !== null ? { quote_snippet: r.quote_snippet } : {}),
    ...(sp ? { section_path: sp } : {}),
    ...(r.pattern_key !== null ? { pattern_key: r.pattern_key } : {}),
    fund_name: r.fund_name,
    ...(r.doc_version_label !== null ? { doc_version_label: r.doc_version_label } : {}),
    ...(r.intent !== null && r.intent !== undefined ? { intent: r.intent } : {}),
    ...(r.scope ? { scope: r.scope } : {}),
    decided_by_name: r.decided_by_name,
    decided_at: r.decided_at,
  };
}

export async function decisionById(ctx: MemoryCtx, id: string): Promise<DecisionDbRow | null> {
  return ctx.db.prepare(DECISION_SQL.byId).bind(ctx.workspaceId, id).first<DecisionDbRow>();
}

export async function currentActive(
  ctx: Pick<MemoryCtx, 'db' | 'workspaceId'>,
  firm: string,
  fingerprint: string,
): Promise<DecisionDbRow | null> {
  return ctx.db
    .prepare(DECISION_SQL.currentActive)
    .bind(ctx.workspaceId, firm, fingerprint)
    .first<DecisionDbRow>();
}

export interface NewDecision {
  id: string;
  law_firm_id: string;
  fingerprint: string;
  issue_class: string;
  pattern_key: string | null;
  quote_hash: string;
  quote_snippet: string;
  section_path: string | null;
  fund_name: string;
  doc_version_label: string | null;
  origin_fund_id: string | null;
  origin_document_id: string | null;
  origin_review_run_id: string | null;
  origin_finding_key: string | null;
  decision: 'accepted' | 'dismissed' | 'answered';
  reason_code: string | null;
  note: string | null;
  counsel_option: string | null;
  counsel_note: string | null;
  counsel_answer_id: string | null;
  supersedes_id: string | null;
  /** Variance (0006): set only on answered decisions; null/absent elsewhere. */
  intent?: string | null;
  scope?: 'fund' | 'firm_template' | null;
}

export function insertDecisionStmt(db: Db, ctx: MemoryCtx, d: NewDecision): D1PreparedStatement {
  return db
    .prepare(DECISION_SQL.insert)
    .bind(
      ctx.workspaceId,
      d.id,
      d.law_firm_id,
      d.fingerprint,
      d.issue_class,
      d.pattern_key,
      d.quote_hash,
      d.quote_snippet,
      d.section_path,
      d.fund_name,
      d.doc_version_label,
      d.origin_fund_id,
      d.origin_document_id,
      d.origin_review_run_id,
      d.origin_finding_key,
      d.decision,
      d.reason_code,
      d.note,
      d.counsel_option,
      d.counsel_note,
      d.counsel_answer_id,
      ctx.analystId,
      ctx.analystName,
      ctx.now,
      d.supersedes_id,
      d.intent ?? null,
      d.scope ?? null,
    );
}

export function supersedeStmt(
  db: Db,
  ctx: MemoryCtx,
  oldId: string,
  newId: string,
): D1PreparedStatement {
  return db.prepare(DECISION_SQL.supersede).bind(ctx.workspaceId, oldId, newId);
}

export function revokeStmt(
  db: Db,
  ctx: MemoryCtx,
  id: string,
  reason: string,
): D1PreparedStatement {
  return db
    .prepare(DECISION_SQL.revoke)
    .bind(ctx.workspaceId, id, ctx.analystName, ctx.now, reason);
}

/** The ActiveDecision a freshly inserted row will read back as. */
export function newDecisionView(ctx: MemoryCtx, d: NewDecision): ActiveDecision {
  return toActiveDecision({
    id: d.id,
    law_firm_id: d.law_firm_id,
    fingerprint: d.fingerprint,
    status: 'active',
    decision: d.decision,
    reason_code: d.reason_code as DecisionDbRow['reason_code'],
    note: d.note,
    counsel_option: d.counsel_option as DecisionDbRow['counsel_option'],
    counsel_note: d.counsel_note,
    issue_class: d.issue_class as DecisionDbRow['issue_class'],
    quote_snippet: d.quote_snippet,
    section_path: d.section_path,
    pattern_key: d.pattern_key,
    fund_name: d.fund_name,
    doc_version_label: d.doc_version_label,
    intent: d.intent ?? null,
    scope: d.scope ?? null,
    decided_by_name: ctx.analystName,
    decided_at: ctx.now,
  });
}
