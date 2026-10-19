import {
  CounselCommentListResponseSchema,
  CounselCommentPostResponseSchema,
  CounselJoinResponseSchema,
  CounselReadyResponseSchema,
  CounselShareResponseSchema,
  CounselSheetResponseSchema,
  COUNSEL_COMMENT_MAX,
  DOC_REF_RE,
  COUNSEL_NAME_MAX,
  SHARE_TOKEN_MAX,
  type CounselComment,
  type CounselJoinResponse,
  type CounselOption,
  type CounselShareRequest,
  type CounselShareResponse,
  type CounselSheetResponse,
} from '@aduin/core';
import { apiUrl } from './base';
import { clientHeaders } from './http';
import { MemoryApiError, toMemoryApiError } from './memoryApi';
import { newClientOpId } from './realMemoryApi';

/**
 * Counsel share link client (counsel-share-link plan, 19-10-26). Plain same-origin fetches with
 * `x-aduin-client: 1` and the cookie (`credentials: 'include'`; JS never reads either cookie). Every
 * response is parsed with the core zod contract; a malformed body is `unavailable`. The analyst
 * routes need the analyst session cookie (callers run `ensureSession()` first); the counsel routes
 * (sheet, comments, answers) work with either cookie. Errors are typed `MemoryApiError`s.
 */
export interface ShareFetchOptions {
  fetch?: typeof fetch;
  url?: (path: string) => string | null;
}

let opts: ShareFetchOptions = {};

/** Structural view of a zod schema (the web never imports zod directly). */
interface Schema<T> {
  safeParse(v: unknown): { success: true; data: T } | { success: false };
}

/** The answer route returns `{decision}`; counsel only needs a JSON object back. */
const AnyObject: Schema<object> = {
  safeParse: (v) => (v && typeof v === 'object' ? { success: true, data: v } : { success: false }),
};

/** Test seam: swap fetch / URL builder (reset with `{}`). */
export function setCounselShareFetch(o: ShareFetchOptions): void {
  opts = o;
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  schema: Schema<T>,
  body?: unknown,
): Promise<T> {
  const url = (opts.url ?? apiUrl)(path);
  if (url === null) throw new MemoryApiError('unavailable', 'API disabled', { reason: 'no_api' });
  const f = opts.fetch ?? ((i: RequestInfo | URL, init?: RequestInit) => fetch(i, init));
  let res: Response;
  try {
    res = await f(url, {
      method,
      headers: clientHeaders(body !== undefined ? { 'content-type': 'application/json' } : {}),
      credentials: 'include',
      cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new MemoryApiError('unavailable', 'Memory is unreachable.', { reason: 'network' });
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw toMemoryApiError(res.status, json);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new MemoryApiError('unavailable', 'malformed counsel response', { reason: 'malformed' });
  }
  return parsed.data;
}

/**
 * Analyst: a fresh share token (valid min(7 days, sandbox expiry)) bound to the bundled document
 * counsel will open (`package:<id>` / `sample:<NN>`).
 */
export function shareLink(docRef: string): Promise<CounselShareResponse> {
  const body: CounselShareRequest = { doc_ref: docRef };
  if (!DOC_REF_RE.test(docRef)) {
    return Promise.reject(
      new MemoryApiError('invalid_request', 'invalid document reference', { reason: 'doc_ref' }),
    );
  }
  return call('POST', '/api/counsel/share', CounselShareResponseSchema, body);
}

/** The link counsel opens: the token travels in the fragment only (never sent, never logged). */
export function shareUrl(
  token: string,
  origin: string = location.origin,
  cfg: string | null = null,
): string {
  // `cfg`: the analyst's package configuration (presentation only; a fragment never reaches a server)
  return `${origin}/#counsel=${token}${cfg ? `&cfg=${cfg}` : ''}`;
}

/** Counsel: exchange the share token + typed name for the counsel cookie. */
export function joinCounsel(token: string, name: string): Promise<CounselJoinResponse> {
  const n = name.replace(/\p{C}/gu, ' ').trim().replace(/\s+/g, ' ');
  if (!n || n.length > COUNSEL_NAME_MAX) {
    return Promise.reject(
      new MemoryApiError('invalid_request', 'name must be 1-80 chars', { reason: 'name' }),
    );
  }
  if (!token || token.length > SHARE_TOKEN_MAX) {
    return Promise.reject(
      new MemoryApiError('invalid_request', 'invalid link', { reason: 'token' }),
    );
  }
  return call('POST', '/api/counsel/join', CounselJoinResponseSchema, { token, name: n });
}

/**
 * Analyst or counsel: questions, active answers, decisions, comments and the ready time. The
 * analyst must name the open bundled document (`doc_ref`); counsel's ref comes from the signed
 * cookie, so counsel calls it without one.
 */
export function getSheet(docRef?: string): Promise<CounselSheetResponse> {
  if (docRef !== undefined && !DOC_REF_RE.test(docRef)) {
    return Promise.reject(
      new MemoryApiError('invalid_request', 'invalid document reference', { reason: 'doc_ref' }),
    );
  }
  const path =
    docRef === undefined
      ? '/api/counsel/sheet'
      : `/api/counsel/sheet?doc_ref=${encodeURIComponent(docRef)}`;
  return call('GET', path, CounselSheetResponseSchema);
}

export function listComments(questionId: string): Promise<CounselComment[]> {
  return call(
    'GET',
    `/api/counsel/comments?question_id=${encodeURIComponent(questionId)}`,
    CounselCommentListResponseSchema,
  ).then((r) => r.comments);
}

export function postComment(questionId: string, body: string): Promise<CounselComment> {
  const b = body.trim();
  if (!b || b.length > COUNSEL_COMMENT_MAX) {
    return Promise.reject(
      new MemoryApiError('invalid_request', 'comment must be 1-1000 chars', { reason: 'body' }),
    );
  }
  return call('POST', '/api/counsel/comments', CounselCommentPostResponseSchema, {
    question_id: questionId,
    body: b,
    client_op_id: newClientOpId(),
  }).then((r) => r.comment);
}

/** Analyst: record `ready_to_digitize` (one audit event). */
export function markReady(): Promise<number> {
  return call('POST', '/api/counsel/ready', CounselReadyResponseSchema, {
    client_op_id: newClientOpId(),
  }).then((r) => r.ready_at);
}

/**
 * Counsel: answer one question (fund scope only; the Worker takes the name from the counsel cookie
 * and the quote from the persisted finding; the fingerprint must equal the question's).
 */
export async function postCounselAnswer(input: {
  question_id: string;
  fingerprint: string;
  option: CounselOption;
  note?: string;
  /** Masked quote echo: the frozen answer contract requires `quote_text`; the Worker ignores it
   * for the counsel cookie (the stored quote is used). */
  quote?: string;
}): Promise<void> {
  const note = input.note?.trim().slice(0, 1000);
  await call('POST', '/api/counsel/answers', AnyObject, {
    client_op_id: newClientOpId(),
    question_id: input.question_id,
    option: input.option,
    fingerprint: input.fingerprint,
    quote_text: (input.quote || 'Shared question').slice(0, 300),
    ...(note ? { note } : {}),
  });
}
