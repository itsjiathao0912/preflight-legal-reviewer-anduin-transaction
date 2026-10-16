// GET /api/memory/health — schema version and seed_mode (no cookie needed; no workspace data).
// The existing GET /api/health ({ok:true}) is untouched.
import type { Handler } from '../../app';
import { jsonNoStore, NO_STORE } from '../../proxy/errors';
import { EXPECTED_SCHEMA_VERSION, readHealth } from '../../memory/health';
import { readGuards, type MemoryDeps } from '../../memory/http';
import { ProxyError, errorResponse } from '../../proxy/errors';

export function memoryHealthHandler(_deps: MemoryDeps): Handler {
  return async (request, env) => {
    try {
      readGuards(request);
    } catch (e) {
      if (e instanceof ProxyError) return errorResponse(e);
      throw e;
    }
    const down = (reason: string) =>
      new Response(
        JSON.stringify({ ok: false, expected_schema_version: EXPECTED_SCHEMA_VERSION, reason }),
        {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': NO_STORE },
        },
      );
    if (!env.DB) return down('no_db');
    try {
      const h = await readHealth(env.DB);
      const body = {
        ok: h.writable,
        schema_version: h.schema_version,
        expected_schema_version: EXPECTED_SCHEMA_VERSION,
        seed_mode: h.seed_mode,
        seed_version: h.seed_version,
      };
      return h.writable
        ? jsonNoStore(body)
        : new Response(JSON.stringify(body), {
            status: 503,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': NO_STORE,
            },
          });
    } catch {
      return down('storage');
    }
  };
}
