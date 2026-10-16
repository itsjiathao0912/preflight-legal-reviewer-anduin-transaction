// Ordered claims (visitor -> global shared provider counter -> spend) with refund.
// Runs only after a cache miss and a Turnstile pass. Keys embed the UTC day, so every
// window resets at UTC midnight. Per-visitor limits apply the stricter of cookie `v` and
// IP hash (both keys must claim), so cookie minting cannot raise the allowance.
import type { QuotaKey, QuotaPort } from '@aduin/core';
import { globalCap, type ProxyConfig } from '../config';
import { utcDay } from './clock';
import type { UsageKeys } from '../proxy/ports';

export type Refusal = {
  code: 'quota_exhausted' | 'budget_cap' | 'rate_limited';
  reason: string;
  retry_after_s?: number;
};

/** Key prefixes: req (AI requests per v), doc (fresh-AI documents), seen (doc marker), ocr (pages), g (global), spend. */
export function keys(v: string, ip: string, nowMs: number) {
  const d = utcDay(nowMs);
  const k = (scope: QuotaKey['scope'], key: string): QuotaKey => ({ scope, key: `${key}|${d}` });
  return {
    reqV: k('visitor_ai', `req|v|${v}`),
    docV: k('visitor_ai', `doc|v|${v}`),
    docIp: k('visitor_ai', `doc|ip|${ip}`),
    seen: (doc: string) => k('visitor_ai', `seen|${v}|${doc}`),
    ocrV: k('visitor_ocr', `ocr|v|${v}`),
    ocrIp: k('visitor_ocr', `ocr|ip|${ip}`),
    global: k('global_ai', 'g|global'),
    spend: { scope: 'spend', key: 'spend|global' } as QuotaKey,
  };
}

export function usageKeys(v: string, ip: string, nowMs: number): UsageKeys {
  const k = keys(v, ip, nowMs);
  return { ai: [k.docV, k.docIp], ocr: [k.ocrV, k.ocrIp], global: k.global };
}

/** Cap for a key (shared by the fake port and, in Phase 04b, the SQL port). */
export function capFor(cfg: ProxyConfig): (key: QuotaKey) => number {
  return (key) => {
    const kind = key.key.split('|')[0];
    switch (kind) {
      case 'req':
        return cfg.visitorAiReqsPerDay;
      case 'doc':
        return cfg.visitorAiDocsPerDay;
      case 'seen':
        return 1;
      case 'ocr':
        return cfg.visitorOcrPagesPerDay;
      case 'g':
        return globalCap(cfg);
      case 'spend':
        return cfg.spendCapMicroUsd;
      default:
        return 0;
    }
  };
}

export class Claims {
  private readonly tokens: { tok: string; scope: QuotaKey['scope'] }[] = [];
  constructor(private readonly port: QuotaPort) {}

  /** Claim; on refusal returns the refusal (prior claims stay held until refundAll). */
  async take(key: QuotaKey, units: number, reason: string): Promise<Refusal | null> {
    const r = await this.port.claim(key, units);
    if (r.ok) {
      this.tokens.push({ tok: r.refundToken, scope: key.scope });
      return null;
    }
    return {
      code: r.code,
      reason: r.reason ?? reason,
      ...(r.retry_after_s !== undefined ? { retry_after_s: r.retry_after_s } : {}),
    };
  }

  /** Marker claim: true when newly taken, false when already present (not an error). */
  async marker(key: QuotaKey): Promise<boolean> {
    const r = await this.port.claim(key, 1);
    if (r.ok) this.tokens.push({ tok: r.refundToken, scope: key.scope });
    return r.ok;
  }

  /** Number of held claims (checkpoint for `refundFrom`). */
  mark(): number {
    return this.tokens.length;
  }

  /** Refund only the claims taken after `mark` (e.g. a paid spend reservation). */
  async refundFrom(mark: number): Promise<void> {
    await this.refundTokens(this.tokens.splice(mark));
  }

  /** Refund only visitor-scoped claims (by scope tag); global + spend stay held. */
  async refundVisitorScoped(): Promise<void> {
    const keep = this.tokens.filter((t) => t.scope === 'global_ai' || t.scope === 'spend');
    const visitor = this.tokens.filter((t) => !keep.includes(t));
    this.tokens.splice(0, this.tokens.length, ...keep);
    await this.refundTokens(visitor);
  }

  /** Scope of each held claim, in claim order (test/inspection aid). */
  scopes(): QuotaKey['scope'][] {
    return this.tokens.map((t) => t.scope);
  }

  async refundAll(): Promise<void> {
    await this.refundTokens(this.tokens.splice(0));
  }

  private async refundTokens(t: { tok: string }[]): Promise<void> {
    for (const { tok } of t.reverse()) {
      try {
        await this.port.refund(tok);
      } catch {
        // refund failures are swallowed: the window expires at UTC midnight anyway
      }
    }
  }
}

/**
 * AI claims: requests on `v`, fresh-document count on `v` AND ip hash when `doc` is new for `v`
 * (stricter of the two: a minted cookie is a new `v`, so every request from it counts as a new
 * document on the ip key), then the global counter. Max 5 claims + 5 refunds + 1 cache read
 * keeps the failure path within the 12 port-call budget.
 */
export async function claimAi(
  c: Claims,
  k: ReturnType<typeof keys>,
  doc: string,
  retryAfterS: number,
): Promise<Refusal | null> {
  const visitor = (r: Refusal): Refusal => ({
    ...r,
    retry_after_s: r.retry_after_s ?? retryAfterS,
  });
  const r0 = await c.take(k.reqV, 1, 'visitor_limit');
  if (r0) return visitor(r0);
  if (await c.marker(k.seen(doc))) {
    for (const key of [k.docV, k.docIp]) {
      const r = await c.take(key, 1, 'visitor_limit');
      if (r) return visitor(r);
    }
  }
  // INVARIANT: global MUST be claimed last, so a refusal here leaves no global claim held and
  // a visitor-limit refusal above never touches the shared provider counter (review F12).
  const g = await c.take(k.global, 1, 'global_cap');
  return g ? { ...g, retry_after_s: g.retry_after_s ?? retryAfterS } : null;
}

/** OCR claims: pages on v + ip, then the SAME global provider counter (pages as units). */
export async function claimOcr(
  c: Claims,
  k: ReturnType<typeof keys>,
  pages: number,
  retryAfterS: number,
): Promise<Refusal | null> {
  for (const key of [k.ocrV, k.ocrIp]) {
    const r = await c.take(key, pages, 'ocr_pages');
    if (r) return { ...r, retry_after_s: r.retry_after_s ?? retryAfterS };
  }
  // INVARIANT: global MUST be claimed last, so a refusal here leaves no global claim held and
  // a visitor-limit refusal above never touches the shared provider counter (review F12).
  const g = await c.take(k.global, pages, 'global_cap');
  return g ? { ...g, retry_after_s: g.retry_after_s ?? retryAfterS } : null;
}
