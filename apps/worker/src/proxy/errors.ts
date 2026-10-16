// Pre-stream HTTP error responses: status via the frozen `errorStatus(code)`, body via the
// shared ErrorDetail schema `{error:{code,message,reason?,retry_after_s?}}`. Every proxy
// response carries `cache-control: no-store` and never any CORS header.
import { errorBody, errorStatus, type ErrorCode } from '@aduin/core';

export const NO_STORE = 'no-store';

const MESSAGES: Record<ErrorCode, string> = {
  fingerprint_mismatch: 'Document fingerprint mismatch.',
  read_only_demo: 'This demo is read-only.',
  rate_limited: 'Too many requests. Please slow down.',
  quota_exhausted: 'AI review is not available right now. Deterministic results are unaffected.',
  budget_cap: 'AI budget reached. Deterministic results are unaffected.',
  upstream_failed: 'The AI provider did not return a usable result.',
  memory_unavailable: 'Memory is unavailable right now.',
  payload_too_large: 'Request body is too large.',
  unsupported_type: 'Unsupported content type.',
  invalid_session: 'Session check failed. Please retry.',
  conflict_active_decision: 'Conflicting active decision.',
  invalid_request: 'Invalid request.',
};

export function messageFor(code: ErrorCode): string {
  return MESSAGES[code];
}

export class ProxyError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly reason?: string,
    readonly retryAfterS?: number,
  ) {
    super(code);
    this.name = 'ProxyError';
  }
}

export function errorResponse(e: ProxyError, extraHeaders: Record<string, string> = {}): Response {
  const body = errorBody({
    code: e.code,
    message: messageFor(e.code),
    ...(e.reason ? { reason: e.reason } : {}),
    ...(e.retryAfterS !== undefined ? { retry_after_s: e.retryAfterS } : {}),
  });
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': NO_STORE,
    ...extraHeaders,
  };
  if (e.retryAfterS !== undefined) headers['retry-after'] = String(e.retryAfterS);
  return new Response(JSON.stringify(body), { status: errorStatus(e.code), headers });
}

export function jsonNoStore(body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': NO_STORE,
      ...extraHeaders,
    },
  });
}
