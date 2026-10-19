// Counsel comments (migration 0007): append-only, one table, per question. Body and author name are
// masked free text (maskFree at the route). Every statement binds workspace_id first.
import type { CounselComment } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

/** Per-question cap (route pre-check; the `comment_cap` trigger is the backstop). */
export const COMMENTS_PER_QUESTION = 50;

const COLS = 'id, question_id, author_role, author_name, body, created_at';

export const COMMENT_SQL = {
  insert:
    'INSERT INTO counsel_comment (workspace_id, id, question_id, author_role, author_name, body, created_at) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  byId: `SELECT ${COLS} FROM counsel_comment WHERE workspace_id = ?1 AND id = ?2`,
  countForQuestion:
    'SELECT COUNT(*) AS n FROM counsel_comment WHERE workspace_id = ?1 AND question_id = ?2',
  listForQuestion: `SELECT ${COLS} FROM counsel_comment WHERE workspace_id = ?1 AND question_id = ?2 ORDER BY created_at, id`,
  listSince: `SELECT ${COLS} FROM counsel_comment WHERE workspace_id = ?1 AND created_at > ?2 ORDER BY created_at, id LIMIT 2000`,
} as const;

export function insertCommentStmt(db: Db, ctx: MemoryCtx, c: CounselComment): D1PreparedStatement {
  return db
    .prepare(COMMENT_SQL.insert)
    .bind(ctx.workspaceId, c.id, c.question_id, c.author_role, c.author_name, c.body, c.created_at);
}

export async function countComments(ctx: MemoryCtx, questionId: string): Promise<number> {
  const r = await ctx.db
    .prepare(COMMENT_SQL.countForQuestion)
    .bind(ctx.workspaceId, questionId)
    .first<{ n: number }>();
  return Number(r?.n ?? 0);
}

export async function listComments(ctx: MemoryCtx, questionId: string): Promise<CounselComment[]> {
  const r = await ctx.db
    .prepare(COMMENT_SQL.listForQuestion)
    .bind(ctx.workspaceId, questionId)
    .all<CounselComment>();
  return r.results;
}

export async function listCommentsSince(ctx: MemoryCtx, since: number): Promise<CounselComment[]> {
  const r = await ctx.db
    .prepare(COMMENT_SQL.listSince)
    .bind(ctx.workspaceId, since)
    .all<CounselComment>();
  return r.results;
}
