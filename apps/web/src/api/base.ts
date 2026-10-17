/**
 * Runtime API base (G16). The build defines VITE_API_BASE: '/' (same origin) for production, the
 * stack bundle and vitest; '' for `--mode e2e` (the preview project has no Worker). It is read ONCE
 * at startup into this module value. '' means "no API": the AI lane fails soft (stub allowance,
 * no banner, no /api/quota, no /api/ai). Only the IS_E2E-guarded `__aduinE2E.setApiBase` changes it
 * at runtime (e2e-hook.ts); nothing attaches the setter to `window` in production.
 */
const BUILD_BASE: unknown = import.meta.env.VITE_API_BASE;
const DEFAULT_BASE: string = typeof BUILD_BASE === 'string' ? BUILD_BASE : '/';

let base = DEFAULT_BASE;
const listeners = new Set<(b: string) => void>();

export function apiBase(): string {
  return base;
}

export function apiEnabled(): boolean {
  return base !== '';
}

/** URL under the API base; null when the base is '' (no network). */
export function apiUrl(path: string): string | null {
  if (base === '') return null;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Change the base (e2e hook only) and notify subscribers (quota refetch). */
export function setApiBaseValue(next: string): void {
  if (next === base) return;
  base = next;
  for (const l of listeners) l(base);
}

export function onApiBaseChange(fn: (b: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
