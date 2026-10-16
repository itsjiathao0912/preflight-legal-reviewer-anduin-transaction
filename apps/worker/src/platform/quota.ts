// D1 QuotaPort. Guarded atomic claim (instruction E1): one statement, numbered parameters bound
// once. The INSERT...SELECT keeps its WHERE (SQLite parse rule for INSERT...SELECT...ON CONFLICT)
// and refuses a FIRST claim whose units exceed the cap; the DO UPDATE ... WHERE refuses a claim
// that would cross the cap. No row returned = refused at cap. Any D1 error THROWS (F5): the
// pipeline then fails closed; `ok:false` is returned ONLY at cap.
import type { QuotaClaimResult, QuotaKey, QuotaPort, QuotaUsage } from '@aduin/core';
import { b64urlDecode, b64urlEncode } from '@aduin/core';
import { nextUtcMidnightS } from '../limits/clock';
import type { UsageKeys } from '../proxy/ports';
import type { Db } from '../db/meta';

/** Global (not workspace-scoped) statements: quota_counter holds no workspace data. */
export const QUOTA_SQL = {
  claim:
    'INSERT INTO quota_counter (scope, key, window, count, updated_at) SELECT ?1, ?2, ?3, ?4, ?6 WHERE ?4 <= ?5 ' +
    'ON CONFLICT(scope, key, window) DO UPDATE SET count = count + ?4, updated_at = ?6 WHERE count + ?4 <= ?5 ' +
    'RETURNING count',
  refund:
    'UPDATE quota_counter SET count = MAX(0, count - ?4), updated_at = ?5 WHERE scope = ?1 AND key = ?2 AND window = ?3',
  peek: 'SELECT count FROM quota_counter WHERE scope = ?1 AND key = ?2 AND window = ?3',
  usage:
    'SELECT scope, key, window, count FROM quota_counter WHERE (scope, key, window) IN ' +
    "(SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]') FROM json_each(?1))",
} as const;

const DAY_SUFFIX = /^(.*)\|(\d{4}-\d{2}-\d{2})$/;

/** Split `base|YYYY-MM-DD` into (base, day); keys without a day suffix use window 'all'. */
export function splitWindow(key: string): { base: string; window: string } {
  const m = DAY_SUFFIX.exec(key);
  return m ? { base: m[1]!, window: m[2]! } : { base: key, window: 'all' };
}

const TOKEN_PREFIX = 'q1.';
const enc = new TextEncoder();
const dec = new TextDecoder();

interface Held {
  scope: string;
  base: string;
  window: string;
  units: number;
}

/** Self-describing refund token: everything the refund needs, no server-side state. */
export function refundToken(h: Held): string {
  return (
    TOKEN_PREFIX + b64urlEncode(enc.encode(JSON.stringify([h.scope, h.base, h.window, h.units])))
  );
}

export function parseRefundToken(tok: string): Held | null {
  if (!tok.startsWith(TOKEN_PREFIX) || tok.length > 600) return null;
  const bytes = b64urlDecode(tok.slice(TOKEN_PREFIX.length));
  if (!bytes) return null;
  try {
    const v: unknown = JSON.parse(dec.decode(bytes));
    if (!Array.isArray(v) || v.length !== 4) return null;
    const [scope, base, window, units] = v as unknown[];
    if (typeof scope !== 'string' || typeof base !== 'string' || typeof window !== 'string')
      return null;
    if (typeof units !== 'number' || !Number.isSafeInteger(units) || units < 1) return null;
    return { scope, base, window, units };
  } catch {
    return null;
  }
}

export interface D1QuotaOptions {
  capFor: (key: QuotaKey) => number;
  now: () => number;
}

/** Atomic claim against the guarded statement. Throws on any storage error (F5). */
export async function claim(
  db: Db,
  opts: D1QuotaOptions,
  key: QuotaKey,
  units: number,
): Promise<QuotaClaimResult> {
  if (!Number.isSafeInteger(units) || units < 1)
    throw new RangeError('units must be a positive integer');
  const cap = opts.capFor(key);
  if (!Number.isSafeInteger(cap) || cap < 0)
    throw new RangeError('cap must be a non-negative integer');
  const { base, window } = splitWindow(key.key);
  const row = await db
    .prepare(QUOTA_SQL.claim)
    .bind(key.scope, base, window, units, cap, opts.now())
    .first<{ count: number }>();
  if (row === null) return { ok: false, code: 'quota_exhausted' };
  return { ok: true, refundToken: refundToken({ scope: key.scope, base, window, units }) };
}

/** Refund clamps at 0. A malformed token is ignored (never trusted from a client). */
export async function refund(db: Db, opts: D1QuotaOptions, tok: string): Promise<void> {
  const h = parseRefundToken(tok);
  if (!h) return;
  await db.prepare(QUOTA_SQL.refund).bind(h.scope, h.base, h.window, h.units, opts.now()).run();
}

export function createD1Quota(db: Db, opts: D1QuotaOptions, keys: UsageKeys): QuotaPort {
  return {
    claim: (key, units) => claim(db, opts, key, units),
    refund: (tok) => refund(db, opts, tok),
    async usage(): Promise<QuotaUsage> {
      const all = [...keys.ai, ...keys.ocr, keys.global];
      const triples = all.map((k) => {
        const { base, window } = splitWindow(k.key);
        return [k.scope, base, window];
      });
      const r = await db.prepare(QUOTA_SQL.usage).bind(JSON.stringify(triples)).all<{
        scope: string;
        key: string;
        window: string;
        count: number;
      }>();
      const count = (k: QuotaKey): number => {
        const { base, window } = splitWindow(k.key);
        const row = r.results.find(
          (x) => x.scope === k.scope && x.key === base && x.window === window,
        );
        return row ? Number(row.count) : 0;
      };
      const max = (ks: QuotaKey[]) => Math.max(0, ...ks.map(count));
      const resets_at = nextUtcMidnightS(opts.now());
      return {
        ai: { used: max(keys.ai), limit: opts.capFor(keys.ai[0]!), resets_at },
        ocr_pages: { used: max(keys.ocr), limit: opts.capFor(keys.ocr[0]!), resets_at },
        global_ok: count(keys.global) < opts.capFor(keys.global),
      };
    },
  };
}
