import type { QuotaKey, QuotaUsage } from './quota';
import type { AiResult } from './ai';
import type { OcrResult } from './ocr';

/** Platform ports v1 (types only; fakes live in Phases 04a/05). All methods are async. */
export interface PlatformPort {
  now(): number;
  randomId(): string;
  sha256Hex(s: string): Promise<string>;
}

export type QuotaClaimResult =
  | { ok: true; refundToken: string }
  | {
      ok: false;
      code: 'quota_exhausted' | 'budget_cap' | 'rate_limited';
      retry_after_s?: number;
      reason?: string;
    };

export interface QuotaPort {
  claim(key: QuotaKey, units: number): Promise<QuotaClaimResult>;
  refund(refundToken: string): Promise<void>;
  usage(): Promise<QuotaUsage>;
}

export type CachedResult =
  | { kind: 'ai'; model: string; data: AiResult; created_at: number }
  | { kind: 'ocr'; model: string; data: OcrResult; created_at: number };

export interface CachePort {
  get(key: string): Promise<CachedResult | null>;
  put(key: string, value: CachedResult, ttl_s: number): Promise<void>;
}

export interface LedgerEntry {
  kind: 'llm' | 'ocr';
  model: string;
  units: number;
  cost_usd?: number;
  cache: 'hit' | 'miss';
  at: number;
}

export interface LedgerPort {
  record(entry: LedgerEntry): Promise<void>;
}

export interface RulesPort {
  activeRules(law_firm_id: string): Promise<{ texts: string[]; rules_hash: string }>;
}

/** Fail closed: any error must resolve to {ok: false}. */
export interface TurnstilePort {
  verify(token: string, ip_hash: string): Promise<{ ok: boolean }>;
}
