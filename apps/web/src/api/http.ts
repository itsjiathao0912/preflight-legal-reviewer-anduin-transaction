/**
 * Shared Worker HTTP helpers (Phase 05; reused by Phase 06 OCR). Every Worker call carries
 * `x-aduin-client: 1` (the Worker refuses calls without it) and the same-origin session cookie.
 */
export const CLIENT_HEADER = 'x-aduin-client';
export const DOC_HEADER = 'x-aduin-doc';
export const TURNSTILE_HEADER = 'x-aduin-turnstile';

/** Error detail from an HTTP error body or a terminal NDJSON error frame (plain data). */
export interface ApiErrorDetail {
  code: string;
  reason?: string;
  message: string;
  retryAfterS?: number;
  /** HTTP status when the error came before the stream (pre-stream refusal). */
  status?: number;
}

export function clientHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { [CLIENT_HEADER]: '1', ...extra };
}

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
}

/** Read `{code, message, reason?, retry_after_s?}` from an unknown object (no schema import, G12). */
export function errorDetailOf(raw: unknown, status?: number): ApiErrorDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = str(o['code'], 64);
  if (!code) return null;
  const d: ApiErrorDetail = { code, message: str(o['message'], 500) ?? code };
  const reason = str(o['reason'], 64);
  if (reason) d.reason = reason;
  const ra = o['retry_after_s'];
  if (typeof ra === 'number' && Number.isFinite(ra) && ra >= 0) d.retryAfterS = Math.floor(ra);
  if (status !== undefined) d.status = status;
  return d;
}

/** Parse an HTTP error response body `{error: {...}}`; falls back to a generic upstream error. */
export async function errorFromResponse(res: Response): Promise<ApiErrorDetail> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const inner =
    body && typeof body === 'object' ? (body as Record<string, unknown>)['error'] : undefined;
  return (
    errorDetailOf(inner, res.status) ?? {
      code: 'upstream_failed',
      reason: `http_${res.status}`,
      message: 'The server did not answer.',
      status: res.status,
    }
  );
}
