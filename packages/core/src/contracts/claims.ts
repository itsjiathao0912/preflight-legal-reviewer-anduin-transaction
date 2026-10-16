import { z } from 'zod';

/**
 * SessionClaims v1 (frozen). Compact names per DATA-MODEL:
 * v visitor id (always), w workspace id, a analyst id (never a visitor id),
 * iat/exp epoch seconds, kid signing key id, t epoch MILLISECONDS of the last Turnstile pass.
 */
const Short = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const SessionClaimsSchema = z
  .object({
    v: Short,
    w: Short.optional(),
    a: Short.optional(),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    kid: Short,
    t: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((c) => c.w === undefined || c.a !== undefined, { message: 'w requires a', path: ['a'] })
  .refine((c) => c.exp > c.iat, { message: 'exp must be after iat', path: ['exp'] });
export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

/** Re-signing preserves existing claims: the patch is merged over the verified claims. */
export function resign(claims: SessionClaims, patch: Partial<SessionClaims>): SessionClaims {
  return SessionClaimsSchema.parse({ ...claims, ...patch });
}

/** POST /api/session */
export const CreateSessionRequestSchema = z.object({
  analyst_name: z.string().trim().min(1).max(80),
  turnstile: z.string().min(1).max(2048).optional(),
});
export const CreateSessionResponseSchema = z.object({
  workspace_id: z.string().min(1).max(64),
  analyst_id: z.string().min(1).max(64),
  kind: z.enum(['sandbox', 'visitor']),
  expires_at: z.number().int().positive(),
  read_only: z.boolean(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;
