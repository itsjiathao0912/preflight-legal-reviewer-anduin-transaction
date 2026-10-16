/** Guarded localStorage: any storage error falls back to defaults and never throws. */
export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked or full: keep the in-memory value */
  }
}

export function safeGetJson(key: string): unknown {
  const raw = safeGet(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** The only persisted UI keys (route, selection, popovers are never persisted). */
export const KEYS = Object.freeze({
  sidebar: 'ui:v1:sidebar',
  filters: 'ui:v1:filters',
  ai: 'ui:v1:ai',
});
