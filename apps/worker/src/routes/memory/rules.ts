// GET/POST /api/rules?law_firm_id= and POST /api/rules/:id/{approve,reject,revoke}.
// Rule text is masked free text and prompt context only; proposed rules never reach AI context.
import {
  firmById,
  LawFirmQuerySchema,
  RuleActionRequestSchema,
  RuleActionResponseSchema,
  RulesResponseSchema,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { newId } from '../../db/ids';
import { memoryCtx } from '../../memory/ctx';
import {
  ConflictError,
  handle,
  ok,
  parseWith,
  pathId,
  readGuards,
  postEntry,
  type MemoryDeps,
} from '../../memory/http';
import { maskFree } from '../../memory/mask';
import { AUDIT_SQL, auditStmt, replayed, type AuditAction } from '../../memory/repo/audit';
import { ruleById, RULES_SQL, rulesForFirm, toRule } from '../../memory/repo/rules';
import { onBatchError, replayResponse } from './decisions';

function firmQuery(request: Request): string {
  const q = parseWith(LawFirmQuerySchema, {
    law_firm_id: new URL(request.url).searchParams.get('law_firm_id') ?? undefined,
  });
  if (!firmById(q.law_firm_id)) throw new ProxyError('invalid_request', 'unknown_firm');
  return q.law_firm_id;
}

export function listRulesHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'rules_list', async (request, env) => {
    readGuards(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: false });
    const firm = firmQuery(request);
    return ok(RulesResponseSchema, { rules: await rulesForFirm(ctx.db, ctx.workspaceId, firm) });
  });
}

export function createRuleHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'rules_create', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: true });
    const firm = firmQuery(request);
    const body = parseWith(RuleActionRequestSchema, raw);
    if (!body.text) throw new ProxyError('invalid_request', 'text_required');
    const id = newId('fr', ctx.now);
    const text = maskFree(body.text);
    const result = {
      rule: { id, text, status: 'active' as const, origin: 'manual' as const, evidence_count: 0 },
    };
    RuleActionResponseSchema.parse(result);
    try {
      await ctx.db.batch([
        auditStmt(ctx.db, ctx, {
          op: body.client_op_id,
          action: 'rule_added',
          lawFirmId: firm,
          entityType: 'rule',
          entityId: id,
          result,
        }),
        ctx.db
          .prepare(RULES_SQL.insertManual)
          .bind(ctx.workspaceId, id, firm, text, ctx.analystName, ctx.now),
      ]);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, 'rule_added');
    }
    return jsonNoStore(result);
  });
}

type RuleAction = 'approve' | 'reject' | 'revoke';
const ACTION: Record<RuleAction, { audit: AuditAction; from: string }> = {
  approve: { audit: 'rule_approved', from: 'proposed' },
  reject: { audit: 'rule_rejected', from: 'proposed' },
  revoke: { audit: 'rule_revoked', from: 'active' },
};

export function ruleActionHandler(deps: MemoryDeps, action: RuleAction): Handler {
  return handle(deps, `rules_${action}`, async (request, env, params) => {
    const id = pathId(params);
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: true });
    const body = parseWith(RuleActionRequestSchema, raw);
    const rule = await ruleById(ctx, id);
    if (!rule) throw new ProxyError('invalid_request', 'rule_not_found');
    const a = ACTION[action];
    if (rule.status !== a.from) {
      // a replay of the op that already moved the rule returns the original result
      if (await replayed(ctx, body.client_op_id))
        return replayResponse(ctx, body.client_op_id, a.audit);
      throw new ProxyError('invalid_request', 'rule_state');
    }
    const text = body.text !== undefined ? maskFree(body.text) : null;
    const after = {
      ...rule,
      status:
        action === 'approve'
          ? ('active' as const)
          : action === 'reject'
            ? ('rejected' as const)
            : ('revoked' as const),
      rule_text: action === 'approve' && text !== null ? text : rule.rule_text,
    };
    const result = { rule: toRule(after) };
    RuleActionResponseSchema.parse(result);
    const update =
      action === 'approve'
        ? ctx.db
            .prepare(RULES_SQL.approve)
            .bind(ctx.workspaceId, id, text, ctx.analystName, ctx.now)
        : action === 'reject'
          ? ctx.db.prepare(RULES_SQL.reject).bind(ctx.workspaceId, id, ctx.analystName, ctx.now)
          : ctx.db
              .prepare(RULES_SQL.revoke)
              .bind(ctx.workspaceId, id, ctx.analystName, ctx.now, text ?? 'revoked');
    let res: D1Result[];
    try {
      res = await ctx.db.batch([
        auditStmt(
          ctx.db,
          ctx,
          {
            op: body.client_op_id,
            action: a.audit,
            lawFirmId: rule.law_firm_id ?? null,
            entityType: 'rule',
            entityId: id,
            ...(action === 'revoke' && text ? { reason: text } : {}),
            result,
          },
          AUDIT_SQL.insertIfRuleStatus,
          [a.from],
        ),
        update,
      ]);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, a.audit);
    }
    if (Number(res[1]?.meta.changes ?? 0) === 0) {
      // Review L4: lost a race (another op moved the rule between the read and the batch); the
      // conditional audit insert wrote nothing, so no duplicate transition event exists.
      if (await replayed(ctx, body.client_op_id))
        return replayResponse(ctx, body.client_op_id, a.audit);
      // Fix cycle 2 (N2): frozen ConflictBodySchema shape (`current: null`), as decisions.ts.
      throw new ConflictError(null);
    }
    return jsonNoStore(result);
  });
}
