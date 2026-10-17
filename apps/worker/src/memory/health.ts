// Schema/seed health. Writes are refused (503 memory_unavailable) when app_meta.schema_version
// differs from the version this code expects or seed_mode is not '0' (a half-applied seed or
// migration fails closed). Per-request check inside the liveness query (stricter than a 60 s cache).
import type { Db } from '../db/meta';

/** Bump together with a new migration (the last statement of each migration sets it). */
export const EXPECTED_SCHEMA_VERSION = '6';
export const DEMO_WORKSPACE_ID = 'ws_demo';

/** Global statement (app_meta holds no workspace data). */
export const HEALTH_SQL = {
  read: "SELECT key, value FROM app_meta WHERE key IN ('schema_version', 'seed_mode', 'seed_version')",
} as const;

export interface SchemaHealth {
  schema_version: string | null;
  seed_mode: string | null;
  seed_version: string | null;
  writable: boolean;
}

export function writable(schemaVersion: string | null, seedMode: string | null): boolean {
  return schemaVersion === EXPECTED_SCHEMA_VERSION && seedMode === '0';
}

export async function readHealth(db: Db): Promise<SchemaHealth> {
  const r = await db.prepare(HEALTH_SQL.read).all<{ key: string; value: string }>();
  const get = (k: string) => r.results.find((x) => x.key === k)?.value ?? null;
  const sv = get('schema_version');
  const sm = get('seed_mode');
  return {
    schema_version: sv,
    seed_mode: sm,
    seed_version: get('seed_version'),
    writable: writable(sv, sm),
  };
}
