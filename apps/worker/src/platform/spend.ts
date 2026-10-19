// Lifetime OpenAI spend counter (OpenAI provider plan, M2). One `quota_counter` row:
// scope 'spend', key 'spend|openai', window 'all' (no day suffix -> never reset, never purged).
// reserve = the guarded atomic QUOTA_SQL.claim (refused when count + units > cap, RETURNING the
// running total); settle moves the reservation to the actual cost: down via a clamped UPDATE,
// up (overrun) via the same claim statement bound with an unbounded cap. Storage errors THROW
// (the pipeline fails closed before dispatch). The counter is authoritative over the ledger.
import type { QuotaKey } from '@aduin/core';
import type { Db } from '../db/meta';
import { QUOTA_SQL } from './quota';

export const SPEND_SCOPE = 'spend' as const;
export const OPENAI_SPEND_KEY: QuotaKey = { scope: SPEND_SCOPE, key: 'spend|openai' };
const WINDOW = 'all';

/** A held reservation (opaque to callers). */
export interface SpendToken {
  readonly units: number;
}

export type SettleWith = number | 'keep' | 'release';
export type SettleOutcome = 'actual' | 'keep' | 'release' | 'overrun';

export interface SettleResult {
  outcome: SettleOutcome;
  /** settled µUSD for this call (0 after a release) */
  settled: number;
  /** running lifetime total after the settle */
  total: number;
}

export interface SpendPort {
  /** Atomic reserve; refused (ok:false) when it would cross the cap. Throws on storage errors. */
  reserve(units: number): Promise<{ ok: true; token: SpendToken; total: number } | { ok: false }>;
  /** Move a reservation to the actual cost, keep it (worst case), or release it fully. */
  settle(token: SpendToken, w: SettleWith): Promise<SettleResult>;
  /** Current lifetime total (read-only). */
  peek(): Promise<number>;
  /** The cap in µUSD. */
  cap(): number;
}

export const SPEND_SQL = {
  down:
    'UPDATE quota_counter SET count = MAX(0, count - ?4), updated_at = ?5 ' +
    'WHERE scope = ?1 AND key = ?2 AND window = ?3 RETURNING count',
} as const;

export interface D1SpendOptions {
  capFor: (key: QuotaKey) => number;
  now: () => number;
}

function units(n: number): number {
  if (!Number.isSafeInteger(n) || n < 1)
    throw new RangeError('spend units must be a positive integer');
  return n;
}

export function createD1Spend(db: Db, opts: D1SpendOptions): SpendPort {
  const cap = (): number => {
    const c = opts.capFor(OPENAI_SPEND_KEY);
    if (!Number.isSafeInteger(c) || c < 0)
      throw new RangeError('spend cap must be a non-negative integer');
    return c;
  };
  const bind = () => [SPEND_SCOPE, OPENAI_SPEND_KEY.key, WINDOW] as const;
  const peek = async (): Promise<number> => {
    const row = await db
      .prepare(QUOTA_SQL.peek)
      .bind(...bind())
      .first<{ count: number }>();
    return row ? Number(row.count) : 0;
  };
  const claimUnits = async (u: number, limit: number): Promise<number | null> => {
    const row = await db
      .prepare(QUOTA_SQL.claim)
      .bind(...bind(), u, limit, opts.now())
      .first<{ count: number }>();
    return row === null ? null : Number(row.count);
  };
  const down = async (u: number): Promise<number> => {
    const row = await db
      .prepare(SPEND_SQL.down)
      .bind(...bind(), u, opts.now())
      .first<{ count: number }>();
    return row ? Number(row.count) : 0;
  };
  return {
    cap,
    peek,
    async reserve(n) {
      const total = await claimUnits(units(n), cap());
      return total === null ? { ok: false } : { ok: true, token: { units: n }, total };
    },
    async settle(token, w) {
      if (w === 'keep') return { outcome: 'keep', settled: token.units, total: await peek() };
      if (w === 'release')
        return { outcome: 'release', settled: 0, total: await down(token.units) };
      const actual = Math.max(0, Math.ceil(w));
      if (actual === token.units)
        return { outcome: 'actual', settled: actual, total: await peek() };
      if (actual < token.units)
        return { outcome: 'actual', settled: actual, total: await down(token.units - actual) };
      // overrun: add the difference without a cap check (never under-count real spend)
      const total = await claimUnits(actual - token.units, Number.MAX_SAFE_INTEGER);
      return { outcome: 'overrun', settled: actual, total: total ?? (await peek()) };
    },
  };
}
