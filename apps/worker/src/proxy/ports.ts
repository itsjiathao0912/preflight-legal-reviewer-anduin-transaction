// Worker-side port bundle over the frozen Phase 01 port types. SQL implementations arrive in
// Phase 04b (`src/platform`); until then the entry wires none and `unavailablePlatform()`
// makes AI/OCR fail closed while `/api/quota` still answers (read-only, zero writes).
import type { CachePort, LedgerPort, QuotaKey, QuotaPort, RulesPort } from '@aduin/core';

/** Keys a visitor-bound QuotaPort reads for `usage()` (max over each list). */
export interface UsageKeys {
  ai: QuotaKey[];
  ocr: QuotaKey[];
  global: QuotaKey;
}

export interface ProxyPlatform {
  /** QuotaPort bound to one visitor's usage keys (`usage()` takes no arguments in v1). */
  quota(keys: UsageKeys): QuotaPort;
  cache: CachePort;
  ledger: LedgerPort;
  /** Unbound seam (unused; the RulesPort is workspace-bound, see `rulesFor`). */
  rules?: RulesPort;
  /**
   * Phase 05 (G1): per-request factory for the workspace-bound RulesPort (active rules only).
   * Undefined when no rules store is wired: a request that needs firm rules then refuses.
   */
  rulesFor?: (workspaceId: string) => RulesPort;
}

export class PortUnavailableError extends Error {
  constructor() {
    super('platform port unavailable');
    this.name = 'PortUnavailableError';
  }
}

export function unavailablePlatform(): ProxyPlatform {
  const fail = (): Promise<never> => Promise.reject(new PortUnavailableError());
  return {
    quota: () => ({
      claim: () =>
        Promise.resolve({ ok: false, code: 'quota_exhausted', reason: 'ai_unavailable' }),
      refund: () => Promise.resolve(),
      usage: fail,
    }),
    cache: { get: () => Promise.resolve(null), put: fail },
    ledger: { record: fail },
  };
}

/**
 * Circuit-breaker state port (tripped for a UTC day + config fingerprint). Phase 04a wires the
 * per-isolate `memoryBreaker()`; Phase 04b may persist it (D1) so every isolate observes a trip.
 * Implementations should throw on storage errors; the pipeline fails closed on `tripped()` errors.
 */
export interface BreakerPort {
  tripped(day: string, fingerprint: string): Promise<boolean>;
  trip(day: string, fingerprint: string): Promise<void>;
}

export function memoryBreaker(): BreakerPort {
  let state: { day: string; fingerprint: string } | null = null;
  return {
    tripped: (day, fingerprint) =>
      Promise.resolve(state !== null && state.day === day && state.fingerprint === fingerprint),
    trip: (day, fingerprint) => {
      state = { day, fingerprint };
      return Promise.resolve();
    },
  };
}
