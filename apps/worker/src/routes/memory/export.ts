// POST /api/runs/:id/export (worker-local zod schema; Phase 08 note) sets sheet_exported_at and
// sheet_question_count and audits `counsel_sheet_exported`. GET /api/export (frozen path, P1
// stretch) returns the workspace memory (decisions, rules, recent audit).
import { ExportResponseSchema } from '@aduin/core';
import { z } from 'zod';
import type { Handler } from '../../app';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { memoryCtx } from '../../memory/ctx';
import {
  handle,
  ok,
  parseWith,
  pathId,
  readGuards,
  readJsonBody,
  type MemoryDeps,
} from '../../memory/http';
import { auditPage, auditStmt } from '../../memory/repo/audit';
import { COUNSEL_SQL } from '../../memory/repo/counsel';
import { DECISION_COLS, toActiveDecision, type DecisionDbRow } from '../../memory/repo/decision';
import { RUN_SQL, runContext } from '../../memory/repo/run';
import { toRule, type RuleDbRow } from '../../memory/repo/rules';
import { onBatchError } from './decisions';

/** Worker-local request schema for the run export (not part of frozen Contracts v1). */
export const RunExportRequestSchema = z.object({
  client_op_id: z.string().min(8).max(64),
  question_count: z.number().int().min(0).max(500),
});
export const RunExportResponseSchema = z.object({
  ok: z.literal(true),
  run_id: z.string().min(1).max(64),
  sheet_exported_at: z.number().int().nonnegative(),
  sheet_question_count: z.number().int().nonnegative(),
});

export const EXPORT_SQL = {
  decisions: `SELECT ${DECISION_COLS} FROM decision d WHERE d.workspace_id = ?1 ORDER BY d.decided_at DESC, d.id DESC LIMIT 1000`,
  rules:
    'SELECT r.id, r.rule_text, r.status, r.origin, r.seed_of, (SELECT COUNT(*) FROM rule_evidence e WHERE ' +
    "e.workspace_id = r.workspace_id AND e.rule_id = r.id) AS evidence_count FROM firm_rule r WHERE r.workspace_id = ?1 AND r.status <> 'revoked'",
} as const;

export function runExportHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'run_export', async (request, env, params) => {
    const runId = pathId(params);
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(RunExportRequestSchema, raw);
    const run = await runContext(ctx, runId);
    if (!run) throw new ProxyError('invalid_request', 'run_not_found');
    const result = {
      ok: true as const,
      run_id: run.id,
      sheet_exported_at: ctx.now,
      sheet_question_count: body.question_count,
    };
    RunExportResponseSchema.parse(result);
    try {
      await ctx.db.batch([
        auditStmt(ctx.db, ctx, {
          op: body.client_op_id,
          action: 'counsel_sheet_exported',
          lawFirmId: run.law_firm_id,
          entityType: 'review_run',
          entityId: run.id,
          detail: { question_count: body.question_count },
          result,
        }),
        ctx.db
          .prepare(RUN_SQL.markExported)
          .bind(ctx.workspaceId, run.id, ctx.now, body.question_count),
        ctx.db.prepare(COUNSEL_SQL.markExported).bind(ctx.workspaceId, run.id, ctx.now),
      ]);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, 'counsel_sheet_exported');
    }
    return jsonNoStore(result);
  });
}

export function workspaceExportHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'export', async (request, env) => {
    readGuards(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: false });
    const [d, r] = await ctx.db.batch([
      ctx.db.prepare(EXPORT_SQL.decisions).bind(ctx.workspaceId),
      ctx.db.prepare(EXPORT_SQL.rules).bind(ctx.workspaceId),
    ]);
    const audit = await auditPage(ctx, 100, null);
    return ok(ExportResponseSchema, {
      export_version: 1,
      decisions: ((d?.results ?? []) as DecisionDbRow[]).map(toActiveDecision),
      rules: ((r?.results ?? []) as RuleDbRow[]).map(toRule),
      audit: audit.events,
    });
  });
}
