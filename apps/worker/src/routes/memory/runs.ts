// POST /api/runs and POST /api/runs/:id/findings (best-effort tier; chunks of <= 50).
// Labels are re-resolved with core `resolveLabel`; `detail.facts`/`explanation` are never stored.
import {
  CreateRunRequestSchema,
  CreateRunResponseSchema,
  firmById,
  resolveLabel,
  StoreFindingsRequestSchema,
  StoreFindingsResponseSchema,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError } from '../../proxy/errors';
import { memoryCtx } from '../../memory/ctx';
import {
  FINDINGS_BODY_CAP,
  handle,
  ok,
  parseWith,
  pathId,
  readJsonBody,
  type MemoryDeps,
} from '../../memory/http';
import { maskFree, maskOpt } from '../../memory/mask';
import { documentUpsertStmt } from '../../memory/repo/document';
import { findingRow, insertFindingsStmts } from '../../memory/repo/finding';
import { fundUpsertStmt, NO_FUND } from '../../memory/repo/fund';
import { lookupActive } from '../../memory/repo/lookup';
import { RUN_SQL, runUpsertStmt } from '../../memory/repo/run';
import { createRulesPort } from '../../platform/rules';

export function createRunHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'runs', async (request, env) => {
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(CreateRunRequestSchema, raw);
    const firm = body.law_firm_id;
    if (firm !== null && !firmById(firm)) throw new ProxyError('invalid_request', 'unknown_firm');
    const rulesHash = firm
      ? (await createRulesPort(ctx.db, ctx.workspaceId).activeRules(firm)).rules_hash
      : 'none';
    const fund = fundUpsertStmt(ctx.db, {
      workspaceId: ctx.workspaceId,
      firm,
      name: maskFree(body.fund_name ?? NO_FUND),
      now: ctx.now,
    });
    const doc = documentUpsertStmt(ctx.db, {
      workspaceId: ctx.workspaceId,
      fundId: fund.id,
      firm,
      displayName: maskFree(body.doc_name),
      contentHash: body.doc_hash,
      versionLabel: maskOpt(body.version_label),
      now: ctx.now,
    });
    const run = runUpsertStmt(ctx.db, {
      workspaceId: ctx.workspaceId,
      documentId: doc.id,
      firm,
      settingsHash: body.settings_hash,
      rulesHash,
      now: ctx.now,
    });
    await ctx.db.batch([fund.stmt, doc.stmt, run.stmt]);
    return ok(CreateRunResponseSchema, { run_id: run.id });
  });
}

export function storeFindingsHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'findings', async (request, env, params) => {
    const runId = pathId(params);
    const raw = await readJsonBody(request, FINDINGS_BODY_CAP);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(StoreFindingsRequestSchema, raw);
    const run = await ctx.db
      .prepare(RUN_SQL.context)
      .bind(ctx.workspaceId, runId)
      .first<{ id: string; law_firm_id: string | null }>();
    if (!run) throw new ProxyError('invalid_request', 'run_not_found');
    const active = run.law_firm_id
      ? await lookupActive(
          ctx.db,
          ctx.workspaceId,
          run.law_firm_id,
          body.findings.map((f) => f.fingerprint),
        )
      : [];
    const byFp = new Map(active.map((d) => [d.fingerprint, d]));
    const rows = body.findings.map((f) => {
      const d = byFp.get(f.fingerprint) ?? null;
      const label = resolveLabel(
        { severity: f.severity, issue_class: f.issue_class, fingerprint: f.fingerprint },
        d,
      );
      return findingRow(f, label, d ? d.id : null);
    });
    const [insert] = await ctx.db.batch(insertFindingsStmts(ctx.db, ctx, runId, rows));
    return ok(StoreFindingsResponseSchema, { stored: Number(insert?.meta.changes ?? 0) });
  });
}
