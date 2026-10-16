// In-memory Quota/Cache/Ledger/Rules ports (also used by Phase 05). Claim semantics match the
// future SQL: a claim succeeds iff count + units <= cap. Counts every call and every write.
import type { CachedResult, LedgerEntry, QuotaKey, QuotaPort, QuotaUsage } from '@aduin/core';
import type { ProxyPlatform, UsageKeys } from '../../src/proxy/ports';

export interface FakePlatformOptions {
  capFor: (key: QuotaKey) => number;
  /** every port call throws (platform unreachable) */
  down?: boolean;
}

export class FakePlatform implements ProxyPlatform {
  readonly counts = new Map<string, number>();
  readonly cacheMap = new Map<string, CachedResult>();
  readonly ledgerRows: LedgerEntry[] = [];
  readonly claimLog: { key: QuotaKey; units: number; ok: boolean }[] = [];
  readonly refunds: string[] = [];
  calls = 0;
  writes = 0;
  down: boolean;
  private readonly held = new Map<string, { id: string; units: number }>();
  private seq = 0;

  constructor(private readonly opts: FakePlatformOptions) {
    this.down = opts.down ?? false;
  }

  private tick(write: boolean): void {
    this.calls++;
    if (this.down) throw new Error('platform down');
    if (write) this.writes++;
  }

  id(key: QuotaKey): string {
    return `${key.scope}:${key.key}`;
  }

  count(key: QuotaKey): number {
    return this.counts.get(this.id(key)) ?? 0;
  }

  /** Preload a counter (e.g. exhausted caps). */
  set(key: QuotaKey, n: number): void {
    this.counts.set(this.id(key), n);
  }

  quota(keys: UsageKeys): QuotaPort {
    return {
      claim: async (key, units) => {
        this.tick(true);
        const id = this.id(key);
        const cur = this.counts.get(id) ?? 0;
        const cap = this.opts.capFor(key);
        if (cur + units > cap) {
          this.writes--; // a refused claim writes nothing
          this.claimLog.push({ key, units, ok: false });
          return { ok: false, code: 'quota_exhausted' };
        }
        this.counts.set(id, cur + units);
        const tok = `r${++this.seq}`;
        this.held.set(tok, { id, units });
        this.claimLog.push({ key, units, ok: true });
        return { ok: true, refundToken: tok };
      },
      refund: async (tok) => {
        this.tick(true);
        const h = this.held.get(tok);
        if (!h) return;
        this.held.delete(tok);
        this.refunds.push(tok);
        this.counts.set(h.id, Math.max(0, (this.counts.get(h.id) ?? 0) - h.units));
      },
      usage: async (): Promise<QuotaUsage> => {
        this.tick(false);
        const max = (ks: QuotaKey[]) => Math.max(0, ...ks.map((k) => this.count(k)));
        return {
          ai: { used: max(keys.ai), limit: this.opts.capFor(keys.ai[0]!), resets_at: 0 },
          ocr_pages: { used: max(keys.ocr), limit: this.opts.capFor(keys.ocr[0]!), resets_at: 0 },
          global_ok: this.count(keys.global) < this.opts.capFor(keys.global),
        };
      },
    };
  }

  cache = {
    get: async (key: string): Promise<CachedResult | null> => {
      this.tick(false);
      return this.cacheMap.get(key) ?? null;
    },
    put: async (key: string, value: CachedResult, _ttl: number): Promise<void> => {
      this.tick(true);
      this.cacheMap.set(key, value);
    },
  };

  ledger = {
    record: async (entry: LedgerEntry): Promise<void> => {
      this.tick(true);
      this.ledgerRows.push(entry);
    },
  };

  rules = {
    activeRules: async (_firm: string) => {
      this.tick(false);
      return { texts: [] as string[], rules_hash: 'none' };
    },
  };
}
