// GET /api/memory/firm?law_firm_id= (frozen canonical) and GET /api/memory/firms/:id (alias).
import { firmById, FirmMemoryResponseSchema, LawFirmQuerySchema } from '@aduin/core';
import type { Handler, RouteParams } from '../../app';
import { ProxyError } from '../../proxy/errors';
import { memoryCtx } from '../../memory/ctx';
import { handle, ok, parseWith, readGuards, type MemoryDeps } from '../../memory/http';
import { DECISION_COLS, toActiveDecision, type DecisionDbRow } from '../../memory/repo/decision';
import { RULES_SQL, toRule, type RuleDbRow } from '../../memory/repo/rules';

export const FIRM_SQL = {
  decisions:
    `SELECT ${DECISION_COLS} FROM decision d WHERE d.workspace_id = ?1 AND d.law_firm_id = ?2 ` +
    "AND d.status = 'active' ORDER BY d.decided_at DESC, d.id DESC LIMIT 200",
  counts:
    "SELECT COUNT(*) AS decisions, COALESCE(SUM(decision = 'dismissed'), 0) AS dismissed, " +
    "COALESCE(SUM(decision = 'answered'), 0) AS answered, COALESCE(SUM(decision = 'accepted'), 0) AS awaiting " +
    "FROM decision WHERE workspace_id = ?1 AND law_firm_id = ?2 AND status = 'active'",
} as const;

function firmFrom(request: Request, params: RouteParams): string {
  const raw = params['id'] ?? new URL(request.url).searchParams.get('law_firm_id') ?? undefined;
  const q = parseWith(LawFirmQuerySchema, { law_firm_id: raw });
  if (!firmById(q.law_firm_id)) throw new ProxyError('invalid_request', 'unknown_firm');
  return q.law_firm_id;
}

export function firmMemoryHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'firm', async (request, env, params) => {
    readGuards(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: false });
    const firm = firmFrom(request, params);
    const [d, r, c] = await ctx.db.batch([
      ctx.db.prepare(FIRM_SQL.decisions).bind(ctx.workspaceId, firm),
      ctx.db.prepare(RULES_SQL.listForFirm).bind(ctx.workspaceId, firm),
      ctx.db.prepare(FIRM_SQL.counts).bind(ctx.workspaceId, firm),
    ]);
    const rules = ((r?.results ?? []) as RuleDbRow[]).map(toRule);
    const counts = ((c?.results ?? [])[0] ?? {}) as Record<string, number>;
    return ok(FirmMemoryResponseSchema, {
      decisions: ((d?.results ?? []) as DecisionDbRow[]).map(toActiveDecision),
      rules,
      counts: {
        decisions: Number(counts['decisions'] ?? 0),
        dismissed: Number(counts['dismissed'] ?? 0),
        answered: Number(counts['answered'] ?? 0),
        awaiting: Number(counts['awaiting'] ?? 0),
        rules_active: rules.filter((x) => x.status === 'active').length,
        rules_proposed: rules.filter((x) => x.status === 'proposed').length,
      },
    });
  });
}
