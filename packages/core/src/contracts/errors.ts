import { z } from 'zod';

/** API contracts v1: error codes (frozen at Phase 01 exit). */
export const ERROR_CODES = [
  'fingerprint_mismatch',
  'read_only_demo',
  'rate_limited',
  'quota_exhausted',
  'budget_cap',
  'upstream_failed',
  'memory_unavailable',
  'payload_too_large',
  'unsupported_type',
  'invalid_session',
  'conflict_active_decision',
  'invalid_request',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Shared error detail. Used by every HTTP error body (`{error: ErrorDetail}`) and,
 * flattened with `t: 'error'`, by the NDJSON terminal error frame. ONE schema.
 */
export const ErrorDetailSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1).max(500),
  /** Additive optional machine-readable detail, e.g. `visitor_limit`. */
  reason: z.string().min(1).max(64).optional(),
  retry_after_s: z.number().int().nonnegative().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/** HTTP error body. `current` is present only for `conflict_active_decision`. */
export const ErrorBodySchema = z.object({
  error: ErrorDetailSchema,
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

/** HTTP status for an error code. Exhaustive: adding a code without a status fails to compile. */
export function errorStatus(code: ErrorCode): number {
  switch (code) {
    case 'fingerprint_mismatch':
      return 422;
    case 'conflict_active_decision':
      return 409;
    case 'read_only_demo':
      return 403;
    case 'invalid_session':
      return 401;
    case 'rate_limited':
      return 429;
    case 'quota_exhausted':
      return 429;
    case 'budget_cap':
      return 503;
    case 'upstream_failed':
      return 502;
    case 'memory_unavailable':
      return 503;
    case 'payload_too_large':
      return 413;
    case 'unsupported_type':
      return 415;
    case 'invalid_request':
      return 400;
    default: {
      const never: never = code;
      throw new Error(`unknown error code ${String(never)}`);
    }
  }
}

export function errorBody(detail: ErrorDetail): ErrorBody {
  return { error: ErrorDetailSchema.parse(detail) };
}
