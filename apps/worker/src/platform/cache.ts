// D1 CachePort over `ai_cache` (global; holds no workspace data). Reads never write (no hit
// counter update on a hit). Expired rows are invisible to reads and removed by the purge.
import type { CachePort, CachedResult } from '@aduin/core';
import type { Db } from '../db/meta';

export const CACHE_SQL = {
  get: 'SELECT result_json FROM ai_cache WHERE key = ?1 AND expires_at > ?2',
  put:
    'INSERT INTO ai_cache (key, kind, model, result_json, bytes, hits, created_at, expires_at) ' +
    'VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7) ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, ' +
    'model = excluded.model, result_json = excluded.result_json, bytes = excluded.bytes, ' +
    'created_at = excluded.created_at, expires_at = excluded.expires_at',
} as const;

function parseCached(text: string): CachedResult | null {
  try {
    const v = JSON.parse(text) as Partial<CachedResult> | null;
    if (!v || (v.kind !== 'ai' && v.kind !== 'ocr')) return null;
    if (typeof v.model !== 'string' || typeof v.created_at !== 'number' || v.data === undefined)
      return null;
    return v as CachedResult;
  } catch {
    return null;
  }
}

export function createD1Cache(db: Db, now: () => number): CachePort {
  return {
    async get(key) {
      const row = await db.prepare(CACHE_SQL.get).bind(key, now()).first<{ result_json: string }>();
      return row ? parseCached(row.result_json) : null;
    },
    async put(key, value, ttl_s) {
      if (!Number.isFinite(ttl_s) || ttl_s <= 0) throw new RangeError('ttl_s must be positive');
      const json = JSON.stringify(value);
      const t = now();
      await db
        .prepare(CACHE_SQL.put)
        .bind(key, value.kind, value.model, json, json.length, t, t + Math.floor(ttl_s * 1000))
        .run();
    },
  };
}
