import { IS_E2E } from '../../e2e-flag';
import { setTurnstileProvider, type TurnstileProvider } from './turnstile';

/**
 * Cloudflare Turnstile widget (Phase 10, D1). The public site key is compiled in from
 * `VITE_TURNSTILE_SITE_KEY`; when it is unset no provider is registered and no script is loaded
 * (requests go out without a token, exactly as before). With a key, the Turnstile script is loaded
 * lazily on the first token request, one managed widget is rendered in a small hidden container
 * with `execution: 'execute'` (revealed as a labelled overlay only while Turnstile needs an
 * interactive challenge, with a longer time budget), every request runs `execute`, and the widget is reset after use so
 * the next request gets a fresh single-use token. The token is never logged.
 *
 * E2E only (stripped from production by the IS_E2E define): the `--mode e2e` bundle has no site
 * key, so a spec may set `window.__aduinTurnstileSiteKey` from `addInitScript`.
 */

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'aduin-turnstile-script';
const CONTAINER_ID = 'aduin-turnstile';
const SITE_KEY_RE = /^[A-Za-z0-9_-]{1,100}$/;
/** Upper bound for one challenge (script load + execute); after it the request goes out tokenless. */
export const TURNSTILE_TIMEOUT_MS = 30_000;
/** Once Turnstile asks for an interactive challenge, a human gets this long (from that moment). */
export const TURNSTILE_INTERACTIVE_TIMEOUT_MS = 120_000;
export const TURNSTILE_PROMPT = 'Verify you are human to use AI features';
const HIDDEN_CSS =
  'position:fixed;right:0;bottom:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
const VISIBLE_CSS =
  'position:fixed;right:16px;bottom:16px;z-index:1000;width:min(340px,calc(100vw - 32px));' +
  'padding:12px;background:var(--card);color:var(--ink);border:1px solid var(--step);' +
  'border-radius:var(--r);font:13px/1.4 var(--sans);pointer-events:auto;opacity:1;';

/** The subset of the Turnstile client API this module uses. */
export interface TurnstileApi {
  render(container: HTMLElement, opts: Record<string, unknown>): string | undefined;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

export interface TurnstileWidgetDeps {
  /** Resolves the global Turnstile API (default: inject the script once, wait for `window.turnstile`). */
  loadApi?: () => Promise<TurnstileApi>;
  /**
   * Host element the widget renders into (default: a slot inside a fixed, invisible overlay
   * appended to body). When the slot's parent is the overlay, the overlay is revealed instead.
   */
  container?: () => HTMLElement;
  timeoutMs?: number;
  /** Total budget once an interactive challenge is shown (default TURNSTILE_INTERACTIVE_TIMEOUT_MS). */
  interactiveTimeoutMs?: number;
}

/** The compiled-in site key (or the e2e window global under IS_E2E); null when unset or malformed. */
export function turnstileSiteKey(): string | null {
  let key: unknown = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (IS_E2E && (typeof key !== 'string' || key === '')) {
    key = (window as unknown as Record<string, unknown>)['__aduinTurnstileSiteKey'];
  }
  return typeof key === 'string' && SITE_KEY_RE.test(key) ? key : null;
}

let scriptLoad: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(timeoutMs: number): Promise<TurnstileApi> {
  if (scriptLoad) return scriptLoad;
  const p = new Promise<TurnstileApi>((resolve, reject) => {
    const w = window as unknown as { turnstile?: TurnstileApi };
    if (w.turnstile) {
      resolve(w.turnstile);
      return;
    }
    const timer = setTimeout(() => reject(new Error('turnstile load timeout')), timeoutMs);
    const done = () => {
      clearTimeout(timer);
      if (w.turnstile) resolve(w.turnstile);
      else reject(new Error('turnstile api missing'));
    };
    let s = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = TURNSTILE_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', done, { once: true });
    s.addEventListener(
      'error',
      () => {
        clearTimeout(timer);
        reject(new Error('turnstile load failed'));
      },
      { once: true },
    );
  });
  // a failed load may be retried by the next request
  scriptLoad = p.catch((e: unknown) => {
    scriptLoad = null;
    document.getElementById(SCRIPT_ID)?.remove();
    throw e;
  });
  return scriptLoad;
}

/** The invisible overlay with a label and a widget slot; returns the slot. */
function hiddenContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = HIDDEN_CSS;
    const label = document.createElement('p');
    label.id = `${CONTAINER_ID}-label`;
    label.textContent = TURNSTILE_PROMPT;
    label.style.cssText = 'margin:0 0 8px;font-weight:500;';
    const slot = document.createElement('div');
    el.append(label, slot);
    document.body.appendChild(el);
  }
  return el.lastElementChild as HTMLElement;
}

/** The element to reveal for an interactive challenge: the overlay when present, else the host. */
function overlayOf(host: HTMLElement): HTMLElement {
  return host.parentElement?.id === CONTAINER_ID ? host.parentElement : host;
}

let restoreFocus: HTMLElement | null = null;

/** Shows the challenge as a small labelled, focusable dialog the user can interact with. */
function reveal(host: HTMLElement): void {
  const el = overlayOf(host);
  if (el.dataset['interactive'] === 'true') return;
  el.dataset['interactive'] = 'true';
  el.removeAttribute('aria-hidden');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  const label = el.querySelector<HTMLElement>(`#${CONTAINER_ID}-label`);
  if (label) el.setAttribute('aria-labelledby', label.id);
  else el.setAttribute('aria-label', TURNSTILE_PROMPT);
  el.tabIndex = -1;
  el.style.cssText = VISIBLE_CSS;
  const active = document.activeElement;
  restoreFocus = active instanceof HTMLElement && active !== document.body ? active : null;
  el.focus({ preventScroll: true });
}

/** Hides the overlay again and returns focus to where the user was. */
function conceal(host: HTMLElement): void {
  const el = overlayOf(host);
  if (el.dataset['interactive'] !== 'true') return;
  delete el.dataset['interactive'];
  el.setAttribute('aria-hidden', 'true');
  el.removeAttribute('role');
  el.removeAttribute('aria-modal');
  el.removeAttribute('aria-labelledby');
  el.removeAttribute('aria-label');
  el.removeAttribute('tabindex');
  el.style.cssText = HIDDEN_CSS;
  const back = restoreFocus;
  restoreFocus = null;
  if (back && el.contains(document.activeElement) && back.isConnected) back.focus();
}

/**
 * Builds a token provider for `siteKey`. Calls are serialized (one widget, one challenge at a time);
 * any failure, expiry or timeout yields null instead of throwing.
 */
export function createTurnstileProvider(
  siteKey: string,
  deps: TurnstileWidgetDeps = {},
): TurnstileProvider {
  const timeoutMs = deps.timeoutMs ?? TURNSTILE_TIMEOUT_MS;
  const interactiveMs = deps.interactiveTimeoutMs ?? TURNSTILE_INTERACTIVE_TIMEOUT_MS;
  const loadApi = deps.loadApi ?? (() => loadTurnstileScript(timeoutMs));
  const container = deps.container ?? hiddenContainer;
  let api: TurnstileApi | null = null;
  let widgetId: string | null = null;
  let host: HTMLElement | null = null;
  let pending: ((token: string | null) => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const settle = (token: string | null) => {
    const p = pending;
    pending = null;
    if (host) conceal(host);
    p?.(token);
  };

  const onInteractive = () => {
    if (!pending || !host) return;
    reveal(host);
    clearTimeout(timer);
    timer = setTimeout(() => settle(null), interactiveMs);
  };

  const ensureWidget = async (): Promise<{ api: TurnstileApi; id: string }> => {
    if (!api) api = await loadApi();
    if (widgetId === null) {
      host = container();
      const id = api.render(host, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        size: 'flexible',
        callback: (t: unknown) => settle(typeof t === 'string' ? t : null),
        'error-callback': () => {
          settle(null);
          return true; // handled: no console error from the widget
        },
        'expired-callback': () => settle(null),
        'timeout-callback': () => settle(null),
        'unsupported-callback': () => settle(null),
        'before-interactive-callback': onInteractive,
        'after-interactive-callback': () => {
          if (host) conceal(host);
        },
      });
      if (typeof id !== 'string' || id === '') throw new Error('turnstile render failed');
      widgetId = id;
    }
    return { api, id: widgetId };
  };

  const once = async (): Promise<string | null> => {
    let w: { api: TurnstileApi; id: string };
    try {
      w = await ensureWidget();
    } catch {
      return null;
    }
    try {
      return await new Promise<string | null>((resolve) => {
        pending = resolve;
        timer = setTimeout(() => settle(null), timeoutMs);
        try {
          w.api.execute(w.id);
        } catch {
          settle(null);
        }
      });
    } finally {
      clearTimeout(timer);
      pending = null;
      if (host) conceal(host);
      try {
        w.api.reset(w.id); // single-use token: fresh challenge next time
      } catch {
        /* a broken widget only means the next request has no token */
      }
    }
  };

  return () => {
    const run = queue.then(once, once);
    queue = run.catch(() => null);
    return run;
  };
}

/** Registers the widget provider when a site key is configured; returns whether it did. */
export function registerTurnstileWidget(deps: TurnstileWidgetDeps = {}): boolean {
  const key = turnstileSiteKey();
  if (!key) return false;
  setTurnstileProvider(createTurnstileProvider(key, deps));
  return true;
}
