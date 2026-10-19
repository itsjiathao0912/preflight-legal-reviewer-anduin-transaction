// Counsel questions (one per run + finding_key; own `id` column returned as question_id) and
// counsel answers (append-only). Interpretations are masked free text.
import { sha256Hex } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

export const COUNSEL_SQL = {
  insertQuestion:
    'INSERT INTO counsel_question (workspace_id, id, review_run_id, finding_key, fingerprint, law_firm_id, ' +
    'issue_class, interpretations_json, created_at, owner, owner_source) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ' +
    'ON CONFLICT(workspace_id, review_run_id, finding_key) DO NOTHING',
  questionById:
    'SELECT id, review_run_id, finding_key, fingerprint, law_firm_id, issue_class, status ' +
    'FROM counsel_question WHERE workspace_id = ?1 AND id = ?2',
  questionByRunKey:
    'SELECT id FROM counsel_question WHERE workspace_id = ?1 AND review_run_id = ?2 AND finding_key = ?3',
  insertAnswer:
    'INSERT INTO counsel_answer (workspace_id, id, question_id, option, note, answered_by_name, answered_at, intent, scope) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
  markAnswered:
    "UPDATE counsel_question SET status = 'answered' WHERE workspace_id = ?1 AND id = ?2",
  /** Counsel share sheet (19-10-26): quote/location come from the persisted finding of the plain
   * finding id (a question key `<findingId>@<owner>` is cut at '@'). */
  sheetQuestions:
    'SELECT q.id, q.finding_key, q.fingerprint, q.issue_class, q.owner, q.draft_text, q.edited_text, q.status, ' +
    'q.interpretations_json, q.created_at, f.severity, f.section_path, f.quote_snippet ' +
    'FROM counsel_question q LEFT JOIN finding f ON f.workspace_id = q.workspace_id AND f.review_run_id = q.review_run_id ' +
    "AND f.finding_key = (CASE WHEN instr(q.finding_key, '@') > 0 THEN substr(q.finding_key, 1, instr(q.finding_key, '@') - 1) ELSE q.finding_key END) " +
    'WHERE q.workspace_id = ?1 ORDER BY q.position, q.created_at, q.id LIMIT 500',
  sheetAnswers:
    'SELECT id, question_id, option, note, answered_by_name, answered_at, intent, scope FROM counsel_answer ' +
    "WHERE workspace_id = ?1 AND status = 'active' AND answered_at > ?2 ORDER BY answered_at, id LIMIT 2000",
  readyAt:
    "SELECT MAX(at) AS at FROM audit_event WHERE workspace_id = ?1 AND action = 'ready_to_digitize'",
  findingQuote:
    'SELECT quote_hash, quote_snippet, section_path FROM finding WHERE workspace_id = ?1 AND review_run_id = ?2 AND finding_key = ?3',
  decisionQuote:
    'SELECT quote_hash, quote_snippet FROM decision WHERE workspace_id = ?1 AND id = ?2',
  markExported:
    "UPDATE counsel_question SET status = 'exported', exported_at = ?3 WHERE workspace_id = ?1 AND review_run_id = ?2 AND status = 'drafted'",
} as const;

export interface QuestionRow {
  id: string;
  review_run_id: string;
  finding_key: string;
  fingerprint: string;
  law_firm_id: string;
  issue_class: string;
  status: 'drafted' | 'exported' | 'answered';
}

export function questionId(workspaceId: string, runId: string, findingKey: string): string {
  return `cq_${sha256Hex(`cq|${workspaceId}|${runId}|${findingKey}`).slice(0, 22)}`;
}

export async function questionById(ctx: MemoryCtx, id: string): Promise<QuestionRow | null> {
  return ctx.db.prepare(COUNSEL_SQL.questionById).bind(ctx.workspaceId, id).first<QuestionRow>();
}

export function insertQuestionStmt(
  db: Db,
  ctx: MemoryCtx,
  q: {
    id: string;
    runId: string;
    findingKey: string;
    fingerprint: string;
    firm: string;
    issueClass: string;
    interpretations: string[];
    owner?: string | null;
    ownerSource?: string | null;
  },
): D1PreparedStatement {
  return db
    .prepare(COUNSEL_SQL.insertQuestion)
    .bind(
      ctx.workspaceId,
      q.id,
      q.runId,
      q.findingKey,
      q.fingerprint,
      q.firm,
      q.issueClass,
      JSON.stringify(q.interpretations),
      ctx.now,
      q.owner ?? null,
      q.ownerSource ?? null,
    );
}

export function insertAnswerStmt(
  db: Db,
  ctx: MemoryCtx,
  a: {
    id: string;
    questionId: string;
    option: string;
    note: string | null;
    intent?: string | null;
    scope?: string | null;
    /** Defaults to the acting analyst's name; the counsel actor passes the counsel name. */
    answeredBy?: string;
  },
): D1PreparedStatement {
  return db
    .prepare(COUNSEL_SQL.insertAnswer)
    .bind(
      ctx.workspaceId,
      a.id,
      a.questionId,
      a.option,
      a.note,
      a.answeredBy ?? ctx.analystName,
      ctx.now,
      a.intent ?? null,
      a.scope ?? null,
    );
}
