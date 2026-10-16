// Persisted circuit breaker (F14) on app_meta (`breaker:{day}` = config fingerprint), so every
// isolate observes a trip. `tripped()` THROWS on a D1 error (the pipeline fails closed);
// `trip()` sets the in-isolate trip FIRST, then persists, so a failed write still trips here.
import type { BreakerPort } from '../proxy/ports';
import type { Db } from '../db/meta';

/** Global statements (app_meta is not workspace data). */
export const BREAKER_SQL = {
  read: 'SELECT value FROM app_meta WHERE key = ?1',
  write:
    'INSERT INTO app_meta (key, value, updated_at) VALUES (?1, ?2, ?3) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
} as const;

export const breakerKey = (day: string) => `breaker:${day}`;

export function createD1Breaker(db: Db, now: () => number = () => Date.now()): BreakerPort {
  let local: { day: string; fingerprint: string } | null = null;
  return {
    async tripped(day, fingerprint) {
      if (local && local.day === day && local.fingerprint === fingerprint) return true;
      const row = await db
        .prepare(BREAKER_SQL.read)
        .bind(breakerKey(day))
        .first<{ value: string }>();
      return row !== null && row.value === fingerprint;
    },
    async trip(day, fingerprint) {
      local = { day, fingerprint };
      await db.prepare(BREAKER_SQL.write).bind(breakerKey(day), fingerprint, now()).run();
    },
  };
}
