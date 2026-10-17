// POST /api/memory/lookup — one query for up to 200 fingerprints, scoped to the cookie workspace,
// plus (Variance Phase 03) ONE bounded SELECT of the active regression checks of the same
// workspace AND the looked-up firm, returned in the optional `regression_checks` array.
import {
  firmById,
  limits,
  MemoryLookupRequestSchema,
  MemoryLookupResponseSchema,
} from '@aduin/core';
import type { Handler } from '../../app';
import { handle, ok, parseWith, postEntry, type MemoryDeps } from '../../memory/http';
import { lookupActive } from '../../memory/repo/lookup';
import { activeChecks } from '../../memory/repo/regression';

export function lookupHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'lookup', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: false });
    const body = parseWith(MemoryLookupRequestSchema, raw);
    if (!firmById(body.law_firm_id)) return ok(MemoryLookupResponseSchema, { decisions: [] });
    const decisions = await lookupActive(
      ctx.db,
      ctx.workspaceId,
      body.law_firm_id,
      body.fingerprints,
    );
    const regression_checks = await activeChecks(
      ctx.db,
      ctx.workspaceId,
      body.law_firm_id,
      limits.regressionChecksPerFirm,
    );
    return ok(MemoryLookupResponseSchema, { decisions, regression_checks });
  });
}
