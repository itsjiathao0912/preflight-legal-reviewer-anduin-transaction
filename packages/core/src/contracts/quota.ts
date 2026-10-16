import { z } from 'zod';

const Bucket = z.object({
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  /** epoch seconds of the next window reset */
  resets_at: z.number().int().nonnegative(),
});

/** GET /api/quota */
export const QuotaResponseSchema = z.object({
  ai: Bucket,
  ocr_pages: Bucket,
  global_ok: z.boolean(),
});
export type QuotaResponse = z.infer<typeof QuotaResponseSchema>;
export type QuotaUsage = QuotaResponse;

export const QUOTA_SCOPES = [
  'visitor_ai',
  'visitor_ocr',
  'global_ai',
  'rate',
  'rate_ai',
  'spend',
  'session_new',
] as const;
export const QuotaKeySchema = z.object({
  scope: z.enum(QUOTA_SCOPES),
  /** visitor id / ip hash / 'global' */
  key: z.string().min(1).max(128),
});
export type QuotaKey = z.infer<typeof QuotaKeySchema>;

/** Machine-readable refusal reasons carried in `reason` (error frame and HTTP body). */
export const QUOTA_REASONS = [
  'visitor_limit',
  'global_cap',
  'spend_cap',
  'ocr_pages',
  'rate',
] as const;
