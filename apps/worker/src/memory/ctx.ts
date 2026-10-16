// Memory request context. The workspace and analyst come ONLY from the verified signed cookie
// (`verifyCookie`, never `resolveVisitor`: memory routes never mint). Liveness (workspace exists,
// kind='sandbox', active, unexpired, analyst present) and schema/seed health are checked in the
// FIRST query of every request; a stale or purged workspace gives 401 invalid_session.
import { verifyCookie } from '@aduin/core';
import type { ProxyConfig } from '../config';
import { readCookie, VISITOR_COOKIE } from '../limits/visitor';
import { ProxyError } from '../proxy/errors';
import { configFor } from '../proxy/pipeline';
import type { Db } from '../db/meta';
import { DEMO_WORKSPACE_ID, readHealth, writable } from './health';
import { WORKSPACE_SQL, type LivenessRow } from './repo/workspace';

/** Analyst marker of a read-only demo session (no `w`): reads bind ws_demo, writes get 403. */
export const READ_ONLY_ANALYST = 'ro';

export interface MemoryCtx {
  db: Db;
  workspaceId: string;
  analystId: string;
  analystName: string;
  now: number;
  readOnly: boolean;
}

export function memoryConfig(env: object): ProxyConfig {
  try {
    const cfg = configFor(env);
    if (!cfg.cookieKeys || !cfg.cookieKid) throw new Error('no cookie keys');
    return cfg;
  } catch {
    throw new ProxyError('memory_unavailable', 'config');
  }
}

export function memoryDb(env: { DB?: D1Database }): Db {
  if (!env.DB) throw new ProxyError('memory_unavailable', 'no_db');
  return env.DB;
}

export async function memoryCtx(
  request: Request,
  env: { DB?: D1Database },
  now: number,
  opts: { write: boolean },
): Promise<MemoryCtx> {
  const cfg = memoryConfig(env);
  const db = memoryDb(env);
  const raw = readCookie(request, VISITOR_COOKIE);
  if (!raw) throw new ProxyError('invalid_session', 'no_session');
  const v = await verifyCookie(raw, cfg.cookieKeys!, Math.floor(now / 1000));
  if (!v.ok) throw new ProxyError('invalid_session', 'bad_cookie');
  const { w, a } = v.claims;
  if (!w || !a) {
    if (!w && a === READ_ONLY_ANALYST) {
      if (opts.write) throw new ProxyError('read_only_demo');
      const h = await readHealth(db);
      if (h.schema_version === null) throw new ProxyError('memory_unavailable', 'schema');
      return {
        db,
        workspaceId: DEMO_WORKSPACE_ID,
        analystId: READ_ONLY_ANALYST,
        analystName: 'Read-only visitor',
        now,
        readOnly: true,
      };
    }
    throw new ProxyError('invalid_session', 'no_workspace');
  }
  const row = await db.prepare(WORKSPACE_SQL.liveness).bind(w, a).first<LivenessRow>();
  if (!row) throw new ProxyError('invalid_session', 'stale_session');
  if (row.kind !== 'sandbox' || row.status !== 'active')
    throw new ProxyError('invalid_session', 'stale_session');
  if (row.expires_at === null || row.expires_at <= now)
    throw new ProxyError('invalid_session', 'expired');
  if (opts.write && !writable(row.schema_version, row.seed_mode))
    throw new ProxyError('memory_unavailable', 'schema');
  return { db, workspaceId: w, analystId: a, analystName: row.display_name, now, readOnly: false };
}
