// Cheap in-isolate fixed-window rate pre-limit (no D1, no subrequest). Runs before identity,
// Turnstile and any port call. Best-effort per isolate; the durable caps live in QuotaPort.
import { limits } from '@aduin/core';
import { ipPrefix } from './visitor';

const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

interface Bucket {
  start: number;
  count: number;
}

export interface PreLimiter {
  /** Returns null when allowed, else retry-after seconds. */
  hit(request: Request, ai: boolean, nowMs: number): number | null;
}

export function createPreLimiter(
  perMin: number = limits.rateLimitPerMin,
  aiPerMin: number = limits.aiRateLimitPerMin,
): PreLimiter {
  const buckets = new Map<string, Bucket>();
  const take = (key: string, cap: number, nowMs: number): number | null => {
    let b = buckets.get(key);
    if (!b || nowMs - b.start >= WINDOW_MS) {
      if (buckets.size >= MAX_KEYS) buckets.clear();
      b = { start: nowMs, count: 0 };
      buckets.set(key, b);
    }
    if (b.count >= cap) return Math.max(1, Math.ceil((b.start + WINDOW_MS - nowMs) / 1000));
    b.count++;
    return null;
  };
  return {
    hit(request, ai, nowMs) {
      const ip = ipPrefix(request.headers.get('cf-connecting-ip'));
      const all = take(`all|${ip}`, perMin, nowMs);
      if (all !== null) return all;
      return ai ? take(`ai|${ip}`, aiPerMin, nowMs) : null;
    },
  };
}
