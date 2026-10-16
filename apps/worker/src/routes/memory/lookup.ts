// POST /api/memory/lookup — one query for up to 200 fingerprints, scoped to the cookie workspace.
import { firmById, MemoryLookupRequestSchema, MemoryLookupResponseSchema } from '@aduin/core';
import type { Handler } from '../../app';
import { handle, ok, parseWith, postEntry, type MemoryDeps } from '../../memory/http';
import { lookupActive } from '../../memory/repo/lookup';

export function lookupHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'lookup', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: false });
    const body = parseWith(MemoryLookupRequestSchema, raw);
    const decisions = firmById(body.law_firm_id)
      ? await lookupActive(ctx.db, ctx.workspaceId, body.law_firm_id, body.fingerprints)
      : [];
    return ok(MemoryLookupResponseSchema, { decisions });
  });
}
