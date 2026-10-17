/**
 * Turnstile token-provider seam (Phase 05). The widget and its site key arrive in Phase 10
 * (`/api/quota` does not expose a site key), so the default provider has no token. Without a token
 * the request goes out without the header; a Worker that needs a fresh pass answers
 * `invalid_session / turnstile_missing` and the lane shows the "verification needed" banner.
 */
export interface TokenOptions {
  /**
   * May Turnstile show an interactive challenge for this request? False for background triggers
   * (document open, automatic memory reads): a challenge that needs a human then resolves null at
   * once instead of popping the overlay. A provider treats `undefined` as true.
   */
  interactive?: boolean;
}

export type TurnstileProvider = (opts?: TokenOptions) => Promise<string | null>;

let provider: TurnstileProvider = async () => null;
let registered = false;

export function setTurnstileProvider(p: TurnstileProvider): void {
  provider = p;
  registered = true;
}

/** True once a real provider is registered (Phase 10: site key compiled in). */
export function hasTurnstileProvider(): boolean {
  return registered;
}

/** How long an explicit user action (click, name edit, Retry) licenses an interactive challenge. */
export const USER_INTENT_WINDOW_MS = 15_000;
let intentUntil = 0;
const intentListeners = new Set<() => void>();

/**
 * Record an explicit user action that needs AI or memory (Run AI, a memory write, Retry, an analyst
 * name edit, opening the Firm memory page). For a short window the next token request may show an
 * interactive challenge, and listeners (the memory client) drop any cached verification failure.
 */
export function markUserIntent(): void {
  intentUntil = Date.now() + USER_INTENT_WINDOW_MS;
  for (const l of intentListeners) {
    try {
      l();
    } catch {
      /* a listener must not break the caller */
    }
  }
}

/** True while a recent explicit user action licenses an interactive challenge. */
export function userIntentActive(): boolean {
  return Date.now() < intentUntil;
}

export function onUserIntent(fn: () => void): () => void {
  intentListeners.add(fn);
  return () => {
    intentListeners.delete(fn);
  };
}

/** Test seam: forget any recorded user intent. */
export function resetUserIntentForTest(): void {
  intentUntil = 0;
}

/**
 * A single-use token, or null. `interactive` defaults to "a user action happened just now", so a
 * background request never pops the challenge overlay.
 */
export async function turnstileToken(opts: TokenOptions = {}): Promise<string | null> {
  try {
    const t = await provider({ interactive: opts.interactive ?? userIntentActive() });
    return typeof t === 'string' && t.length > 0 && t.length <= 2048 ? t : null;
  } catch {
    return null;
  }
}
