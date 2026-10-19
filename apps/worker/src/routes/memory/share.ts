// Counsel share link routes (19-10-26, demo-grade, no revoke):
//   POST /api/counsel/share     analyst only  -> {token, expires_at} (link `#counsel=<token>`)
//   POST /api/counsel/join      no cookie     -> sets `__Host-aduin_c`; {workspace_id, counsel_name, expires_at}
//   GET  /api/counsel/sheet     analyst|counsel -> {role, doc_ref, questions, answers, comments, decisions, ready_at}
//   GET  /api/counsel/comments  analyst|counsel -> {comments} for ?question_id=
//   POST /api/counsel/comments  analyst|counsel -> {comment}
//   POST /api/counsel/ready     analyst only  -> {ready_at}; one `ready_to_digitize` audit row
// Every other memory route keeps the analyst-cookie-only `memoryCtx`, so counsel can answer and
// comment but never decide, export, edit rules, create runs/questions, share or mark ready. The
// workspace always comes from a verified cookie or the verified share token, never from the body.
import {
  CounselCommentListResponseSchema,
  CounselCommentPostResponseSchema,
  CounselCommentPostSchema,
  CounselJoinRequestSchema,
  CounselJoinResponseSchema,
  CounselReadyRequestSchema,
  CounselReadyResponseSchema,
  CounselShareRequestSchema,
  DocRefSchema,
  CounselShareResponseSchema,
  CounselSheetResponseSchema,
  COUNSEL_NAME_MAX,
  IssueClassSchema,
  parseQuestionKey,
  sha256Hex,
  type ActiveDecision,
  type CounselComment,
  type CounselSheetAnswer,
  type CounselSheetQuestion,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ID_RE } from '../../db/ids';
import { classifyBatchError } from '../../db/tx';
import { MEMORY_WRITE_WEIGHTS } from '../../platform/index';
import { ProxyError } from '../../proxy/errors';
import { parseJsonObject, readBodyCapped } from '../../proxy/guards';
import { counselCtx, memoryConfig, memoryDb, type CounselMemoryCtx } from '../../memory/ctx';
import {
  counselPostEntry,
  handle,
  MEMORY_BODY_CAP,
  ok,
  parseWith,
  postEntry,
  readGuards,
  writeHeaderGuards,
  type MemoryDeps,
} from '../../memory/http';
import { maskFree } from '../../memory/mask';
import { auditStmt } from '../../memory/repo/audit';
import {
  COMMENT_SQL,
  COMMENTS_PER_QUESTION,
  countComments,
  insertCommentStmt,
  listComments,
  listCommentsSince,
} from '../../memory/repo/comment';
import { COUNSEL_SQL, questionById } from '../../memory/repo/counsel';
import { DECISION_SQL, toActiveDecision, type DecisionDbRow } from '../../memory/repo/decision';
import { WORKSPACE_SQL, type LivenessRow } from '../../memory/repo/workspace';
import {
  counselSetCookie,
  shareExpiry,
  signCounselCookie,
  signShare,
  verifyShare,
} from '../../memory/share';
import { replayResponse } from './decisions';

/** POST /api/counsel/share — analyst only; no DB write. */
export function shareHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_share', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: false });
    if (ctx.readOnly) throw new ProxyError('read_only_demo');
    const parsed = CounselShareRequestSchema.safeParse(raw);
    if (!parsed.success) throw new ProxyError('invalid_request', 'doc_ref');
    const docRef = parsed.data.doc_ref;
    const row = await ctx.db
      .prepare(WORKSPACE_SQL.expiry)
      .bind(ctx.workspaceId)
      .first<{ expires_at: number | null }>();
    if (!row || row.expires_at === null) throw new ProxyError('invalid_session', 'stale_session');
    const cfg = memoryConfig(env);
    const exp = shareExpiry(ctx.now, row.expires_at);
    const token = await signShare(
      { w: ctx.workspaceId, a: ctx.analystId, d: docRef, r: 'counsel', exp, kid: cfg.cookieKid! },
      cfg.cookieKeys!,
    );
    return ok(CounselShareResponseSchema, { token, expires_at: exp * 1000 });
  });
}

/** POST /api/counsel/join — the token is the credential; sets the counsel cookie. No DB write. */
export function joinHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_join', async (request, env) => {
    writeHeaderGuards(request);
    const cfg = memoryConfig(env);
    const db = memoryDb(env);
    const now = deps.now();
    const nowS = Math.floor(now / 1000);
    const raw = parseJsonObject(await readBodyCapped(request, MEMORY_BODY_CAP));
    const body = parseWith(CounselJoinRequestSchema, raw);
    const v = await verifyShare(body.token, cfg.cookieKeys!, nowS);
    if (!v.ok) throw new ProxyError('invalid_session', `share_${v.reason}`);
    const name = maskFree(body.name.trim()).slice(0, COUNSEL_NAME_MAX).trim();
    if (name.length === 0) throw new ProxyError('invalid_request', 'name_required');
    const live = await db
      .prepare(WORKSPACE_SQL.liveness)
      .bind(v.claims.w, v.claims.a)
      .first<LivenessRow>();
    if (
      !live ||
      live.kind !== 'sandbox' ||
      live.status !== 'active' ||
      live.expires_at === null ||
      live.expires_at <= now
    )
      throw new ProxyError('invalid_session', 'stale_session');
    // never outlive the sandbox (a token minted before an expiry change stays bounded)
    const exp = Math.min(v.claims.exp, Math.floor(live.expires_at / 1000));
    if (exp <= nowS) throw new ProxyError('invalid_session', 'share_expired');
    const cookie = await signCounselCookie(
      {
        w: v.claims.w,
        a: v.claims.a,
        d: v.claims.d,
        r: 'counsel',
        n: name,
        exp,
        kid: cfg.cookieKid!,
      },
      cfg.cookieKeys!,
    );
    const res = ok(CounselJoinResponseSchema, {
      workspace_id: v.claims.w,
      counsel_name: name,
      expires_at: exp * 1000,
      doc_ref: v.claims.d,
    });
    res.headers.set('set-cookie', counselSetCookie(cookie, exp, nowS));
    return res;
  });
}

function sinceParam(request: Request): number {
  const raw = new URL(request.url).searchParams.get('since');
  if (raw === null || raw === '') return 0;
  if (!/^\d{1,16}$/.test(raw)) throw new ProxyError('invalid_request', 'since');
  return Number(raw);
}

interface SheetQuestionRow {
  id: string;
  finding_key: string;
  fingerprint: string;
  issue_class: string;
  owner: string | null;
  draft_text: string | null;
  edited_text: string | null;
  status: CounselSheetQuestion['status'];
  interpretations_json: string;
  created_at: number;
  severity: string | null;
  section_path: string | null;
  quote_snippet: string | null;
}

function parseStrings(json: string | null): string[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toSheetQuestion(r: SheetQuestionRow): CounselSheetQuestion | null {
  if (!IssueClassSchema.safeParse(r.issue_class).success) return null;
  const location = parseStrings(r.section_path).join(' > ');
  return {
    id: r.id,
    finding_id: parseQuestionKey(r.finding_key).findingId,
    finding_key: r.finding_key,
    fingerprint: r.fingerprint,
    issue_class: r.issue_class as CounselSheetQuestion['issue_class'],
    ...(r.severity
      ? { severity: r.severity as NonNullable<CounselSheetQuestion['severity']> }
      : {}),
    ...(r.owner ? { owner: r.owner as NonNullable<CounselSheetQuestion['owner']> } : {}),
    ...(location ? { location: location.slice(0, 2500) } : {}),
    ...(r.quote_snippet ? { quote_masked: r.quote_snippet } : {}),
    ...(r.draft_text ? { draft_text: r.draft_text } : {}),
    ...(r.edited_text ? { edited_text: r.edited_text } : {}),
    status: r.status,
    interpretations: parseStrings(r.interpretations_json).slice(0, 6),
    created_at: r.created_at,
  };
}

interface SheetAnswerRow {
  id: string;
  question_id: string;
  option: CounselSheetAnswer['option'];
  note: string | null;
  answered_by_name: string;
  answered_at: number;
  intent: string | null;
  scope: CounselSheetAnswer['scope'] | null;
}

function toSheetAnswer(r: SheetAnswerRow): CounselSheetAnswer {
  return {
    id: r.id,
    question_id: r.question_id,
    option: r.option,
    ...(r.note ? { note: r.note } : {}),
    answered_by_name: r.answered_by_name,
    answered_at: r.answered_at,
    ...(r.intent ? { intent: r.intent } : {}),
    ...(r.scope ? { scope: r.scope } : {}),
  };
}

/**
 * The sheet's doc ref: counsel gets the one signed into its cookie (query ignored); the analyst
 * holds no share state server-side, so it names the open document with `?doc_ref=`.
 */
function sheetDocRef(request: Request, ctx: CounselMemoryCtx): string {
  if (ctx.actor === 'counsel') {
    if (!ctx.docRef) throw new ProxyError('invalid_session', 'bad_cookie');
    return ctx.docRef;
  }
  const q = DocRefSchema.safeParse(new URL(request.url).searchParams.get('doc_ref'));
  if (!q.success) throw new ProxyError('invalid_request', 'doc_ref');
  return q.data;
}

/**
 * GET /api/counsel/sheet[?since=<ms>][&doc_ref=<ref> analyst] — analyst or counsel. `since`
 * filters answers + comments; `decisions` are always the full active set (capped 500).
 */
export function sheetHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_sheet', async (request, env) => {
    readGuards(request);
    const ctx = await counselCtx(request, env, deps.now(), { write: false });
    const since = sinceParam(request);
    const docRef = sheetDocRef(request, ctx);
    const [qs, as, comments, ready, ds] = await Promise.all([
      ctx.db.prepare(COUNSEL_SQL.sheetQuestions).bind(ctx.workspaceId).all<SheetQuestionRow>(),
      ctx.db.prepare(COUNSEL_SQL.sheetAnswers).bind(ctx.workspaceId, since).all<SheetAnswerRow>(),
      listCommentsSince(ctx, since),
      ctx.db.prepare(COUNSEL_SQL.readyAt).bind(ctx.workspaceId).first<{ at: number | null }>(),
      ctx.db.prepare(DECISION_SQL.listActive).bind(ctx.workspaceId).all<DecisionDbRow>(),
    ]);
    const decisions: ActiveDecision[] = ds.results.map(toActiveDecision);
    return ok(CounselSheetResponseSchema, {
      role: ctx.actor,
      doc_ref: docRef,
      questions: qs.results
        .map(toSheetQuestion)
        .filter((q): q is CounselSheetQuestion => q !== null),
      answers: as.results.map(toSheetAnswer),
      comments,
      decisions,
      ready_at: ready?.at ?? null,
    });
  });
}

async function requireQuestion(ctx: CounselMemoryCtx, id: string): Promise<void> {
  if (!ID_RE.test(id)) throw new ProxyError('invalid_request', 'question_id');
  if (!(await questionById(ctx, id))) throw new ProxyError('invalid_request', 'question_not_found');
}

/** GET /api/counsel/comments?question_id= — analyst or counsel. */
export function listCommentsHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_comments_list', async (request, env) => {
    readGuards(request);
    const ctx = await counselCtx(request, env, deps.now(), { write: false });
    const qid = new URL(request.url).searchParams.get('question_id') ?? '';
    await requireQuestion(ctx, qid);
    return ok(CounselCommentListResponseSchema, { comments: await listComments(ctx, qid) });
  });
}

/** Deterministic comment id from the client op id: a retried post returns the stored comment. */
export function commentId(workspaceId: string, clientOpId: string): string {
  return `cc_${sha256Hex(`cc|${workspaceId}|${clientOpId}`).slice(0, 22)}`;
}

/** POST /api/counsel/comments — analyst or counsel; body masked; 50 per question. */
export function postCommentHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_comments', async (request, env) => {
    const { ctx, raw } = await counselPostEntry(request, env, deps.now(), {
      weight: MEMORY_WRITE_WEIGHTS.counselComment,
    });
    const body = parseWith(CounselCommentPostSchema, raw);
    await requireQuestion(ctx, body.question_id);
    const id = commentId(ctx.workspaceId, body.client_op_id);
    const existing = await ctx.db
      .prepare(COMMENT_SQL.byId)
      .bind(ctx.workspaceId, id)
      .first<CounselComment>();
    if (existing) {
      if (existing.question_id !== body.question_id)
        throw new ProxyError('invalid_request', 'op_reused');
      return ok(CounselCommentPostResponseSchema, { comment: existing });
    }
    if ((await countComments(ctx, body.question_id)) >= COMMENTS_PER_QUESTION)
      throw new ProxyError('quota_exhausted', 'comment_cap');
    const text = maskFree(body.body.trim());
    if (text.length === 0) throw new ProxyError('invalid_request', 'body_required');
    const comment: CounselComment = {
      id,
      question_id: body.question_id,
      author_role: ctx.actor,
      author_name: ctx.actor === 'counsel' ? ctx.counselName! : ctx.analystName,
      body: text.slice(0, 1000),
      created_at: ctx.now,
    };
    try {
      await insertCommentStmt(ctx.db, ctx, comment).run();
    } catch (e) {
      const kind = classifyBatchError(e);
      if (kind.kind === 'trigger' && kind.trigger === 'comment_cap')
        throw new ProxyError('quota_exhausted', 'comment_cap');
      throw e;
    }
    return ok(CounselCommentPostResponseSchema, { comment });
  });
}

/** POST /api/counsel/ready — analyst only; idempotent through the audit client_op_id. */
export function readyHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_ready', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), {
      write: true,
      weight: MEMORY_WRITE_WEIGHTS.other,
    });
    const body = parseWith(CounselReadyRequestSchema, raw);
    const result = CounselReadyResponseSchema.parse({ ready_at: ctx.now });
    try {
      await auditStmt(ctx.db, ctx, {
        op: body.client_op_id,
        action: 'ready_to_digitize',
        entityType: 'workspace',
        entityId: ctx.workspaceId,
        result,
      }).run();
    } catch (e) {
      if (classifyBatchError(e).kind === 'op_replay')
        return replayResponse(ctx, body.client_op_id, 'ready_to_digitize');
      throw e;
    }
    return ok(CounselReadyResponseSchema, result);
  });
}
