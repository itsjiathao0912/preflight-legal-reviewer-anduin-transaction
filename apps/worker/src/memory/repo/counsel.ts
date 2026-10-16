// Counsel questions (one per run + finding_key; own `id` column returned as question_id) and
// counsel answers (append-only). Interpretations are masked free text.
import { sha256Hex } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

export const COUNSEL_SQL = {
  insertQuestion:
    'INSERT INTO counsel_question (workspace_id, id, review_run_id, finding_key, fingerprint, law_firm_id, ' +
    'issue_class, interpretations_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ' +
    'ON CONFLICT(workspace_id, review_run_id, finding_key) DO NOTHING',
  questionById:
    'SELECT id, review_run_id, finding_key, fingerprint, law_firm_id, issue_class, status ' +
    'FROM counsel_question WHERE workspace_id = ?1 AND id = ?2',
  questionByRunKey:
    'SELECT id FROM counsel_question WHERE workspace_id = ?1 AND review_run_id = ?2 AND finding_key = ?3',
  insertAnswer:
    'INSERT INTO counsel_answer (workspace_id, id, question_id, option, note, answered_by_name, answered_at) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  markAnswered:
    "UPDATE counsel_question SET status = 'answered' WHERE workspace_id = ?1 AND id = ?2",
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
    );
}

export function insertAnswerStmt(
  db: Db,
  ctx: MemoryCtx,
  a: { id: string; questionId: string; option: string; note: string | null },
): D1PreparedStatement {
  return db
    .prepare(COUNSEL_SQL.insertAnswer)
    .bind(ctx.workspaceId, a.id, a.questionId, a.option, a.note, ctx.analystName, ctx.now);
}
