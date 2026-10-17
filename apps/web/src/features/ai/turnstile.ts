/**
 * Turnstile token-provider seam (Phase 05). The widget and its site key arrive in Phase 10
 * (`/api/quota` does not expose a site key), so the default provider has no token. Without a token
 * the request goes out without the header; a Worker that needs a fresh pass answers
 * `invalid_session / turnstile_missing` and the lane shows the "verification needed" banner.
 */
export type TurnstileProvider = () => Promise<string | null>;

let provider: TurnstileProvider = async () => null;

export function setTurnstileProvider(p: TurnstileProvider): void {
  provider = p;
}

export async function turnstileToken(): Promise<string | null> {
  try {
    const t = await provider();
    return typeof t === 'string' && t.length > 0 && t.length <= 2048 ? t : null;
  } catch {
    return null;
  }
}
