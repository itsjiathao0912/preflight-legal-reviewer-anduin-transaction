// Real TurnstilePort: Cloudflare siteverify through the injected fetch. Fails closed: any
// network error, timeout (5 s), non-2xx, malformed body or `success !== true` resolves to {ok:false}.
import type { TurnstilePort } from '@aduin/core';

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_HEADER = 'x-aduin-turnstile';

/** siteverify must answer within this bound; a timeout fails closed. */
export const SITEVERIFY_TIMEOUT_MS = 5_000;

export function createTurnstile(
  fetchFn: typeof fetch,
  secret: string | undefined,
  timeoutMs: number = SITEVERIFY_TIMEOUT_MS,
): TurnstilePort {
  return {
    async verify(token) {
      if (!secret || !token || token.length > 2048) return { ok: false };
      try {
        const res = await fetchFn(SITEVERIFY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }).toString(),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) return { ok: false };
        const j: unknown = await res.json();
        return {
          ok: typeof j === 'object' && j !== null && (j as { success?: unknown }).success === true,
        };
      } catch {
        return { ok: false };
      }
    },
  };
}
