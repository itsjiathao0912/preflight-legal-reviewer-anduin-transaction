// POST /api/decisions and POST /api/decisions/:id/revoke.
// Dismiss batch (one atomic db.batch): audit FIRST -> supersede the previous active row -> insert
// the new active row -> finding_state upsert -> rule-proposal statements. A replayed client_op_id
// (audit UNIQUE) returns the ORIGINAL 200 body; a uq_decision_active race returns 409 with
// `current`. The two are told apart by the constraint text recorded in S8.
// A0: the firm comes from run_id -> review_run.law_firm_id; unknown request keys are stripped.
import {
  CreateDecisionRequestSchema,
  CreateDecisionResponseSchema,
  fingerprintMatches,
  quoteHash,
  RevokeDecisionRequestSchema,
  RevokeDecisionResponseSchema,
  type ActiveDecision,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { newId } from '../../db/ids';
import { classifyBatchError } from '../../db/tx';
import { memoryCtx, type MemoryCtx } from '../../memory/ctx';
import {
  ConflictError,
  handle,
  parseWith,
  pathId,
  readJsonBody,
  type MemoryDeps,
} from '../../memory/http';
import { maskFree, maskOpt, snippetOf } from '../../memory/mask';
import { proposalStmts } from '../../memory/proposal';
import { AUDIT_SQL, auditStmt, replayed, type AuditAction } from '../../memory/repo/audit';
import {
  currentActive,
  decisionById,
  insertDecisionStmt,
  newDecisionView,
  revokeStmt,
  supersedeStmt,
  toActiveDecision,
  type NewDecision,
} from '../../memory/repo/decision';
import { reopenStateStmt, upsertStateStmt } from '../../memory/repo/finding';
import { runContext } from '../../memory/repo/run';

/** E6 pattern-key charset (compatible with Phase 02 `patternKey` and the proposal_key delimiter). */
export const PATTERN_KEY_RE = /^[a-z0-9:#>-]{1,80}$/;

/** 200 with the stored original result of a replayed op (same action), else 400 op_reused. */
export async function replayResponse(
  ctx: MemoryCtx,
  op: string,
  action: AuditAction,
): Promise<Response> {
  const r = await replayed(ctx, op);
  if (!r || r.action !== action || r.result === null)
    throw new ProxyError('invalid_request', 'op_reused');
  return jsonNoStore(r.result);
}

export function fingerprintOk(
  quote: string,
  firm: string,
  issueClass: string,
  fp: string,
): boolean {
  try {
    return fingerprintMatches(quote, firm, issueClass, fp);
  } catch {
    return false;
  }
}

/** Map a failed write batch: replay -> original 200; active race -> 409 + current; else rethrow. */
export async function onBatchError(
  e: unknown,
  ctx: MemoryCtx,
  op: string,
  action: AuditAction,
  conflict?: { firm: string; fingerprint: string },
): Promise<Response> {
  const kind = classifyBatchError(e);
  if (kind.kind === 'op_replay') return replayResponse(ctx, op, action);
  if (kind.kind === 'active_conflict' && conflict) {
    const cur = await currentActive(ctx, conflict.firm, conflict.fingerprint);
    throw new ConflictError(cur ? toActiveDecision(cur) : null);
  }
  if (kind.kind === 'trigger' && kind.trigger === 'decision_immutable') {
    throw new ConflictError(null);
  }
  throw e;
}

export function createDecisionHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'decisions', async (request, env) => {
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(CreateDecisionRequestSchema, raw);
    if (!body.run_id) throw new ProxyError('invalid_request', 'run_required');
    if (body.pattern_key !== undefined && !PATTERN_KEY_RE.test(body.pattern_key))
      throw new ProxyError('invalid_request', 'pattern_key');
    const run = await runContext(ctx, body.run_id);
    if (!run) throw new ProxyError('invalid_request', 'run_not_found');
    if (!run.law_firm_id) throw new ProxyError('invalid_request', 'firm_required');
    const firm = run.law_firm_id;
    if (!fingerprintOk(body.quote_text, firm, body.issue_class, body.fingerprint))
      throw new ProxyError('fingerprint_mismatch');
    // The full quote is dropped after hashing; only the masked <=300-char snippet is stored.
    const qh = quoteHash(body.quote_text);
    const snippet = snippetOf(body.quote_text);
    const prev = await currentActive(ctx, firm, body.fingerprint);
    const d: NewDecision = {
      id: newId('dc', ctx.now),
      law_firm_id: firm,
      fingerprint: body.fingerprint,
      issue_class: body.issue_class,
      pattern_key: body.pattern_key ?? null,
      quote_hash: qh,
      quote_snippet: snippet,
      section_path: null,
      fund_name: maskFree(body.fund_name ?? run.fund_name),
      doc_version_label: maskOpt(body.doc_version_label ?? run.version_label),
      origin_fund_id: run.fund_id,
      origin_document_id: run.document_id,
      origin_review_run_id: run.id,
      origin_finding_key: body.finding_ref,
      decision: body.decision,
      reason_code: body.reason_code ?? null,
      note: maskOpt(body.note),
      counsel_option: null,
      counsel_note: null,
      counsel_answer_id: null,
      supersedes_id: prev ? prev.id : null,
    };
    const result = { decision: newDecisionView(ctx, d) };
    CreateDecisionResponseSchema.parse(result);
    const stmts = [
      auditStmt(ctx.db, ctx, {
        op: body.client_op_id,
        action: 'decision_recorded',
        lawFirmId: firm,
        entityType: 'decision',
        entityId: d.id,
        detail: {
          decision: d.decision,
          issue_class: d.issue_class,
          reason_code: d.reason_code,
          supersedes: d.supersedes_id,
        },
        result,
      }),
      ...(prev ? [supersedeStmt(ctx.db, ctx, prev.id, d.id)] : []),
      insertDecisionStmt(ctx.db, ctx, d),
      upsertStateStmt(ctx.db, ctx, {
        runId: run.id,
        findingKey: body.finding_ref,
        status: body.decision,
        needsCounsel: body.decision === 'accepted',
        decisionId: d.id,
      }),
      ...(body.decision === 'dismissed'
        ? proposalStmts(ctx.db, ctx, {
            firm,
            patternKey: d.pattern_key,
            reason: body.reason_code ?? null,
            op: body.client_op_id,
          })
        : []),
    ];
    try {
      await ctx.db.batch(stmts);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, 'decision_recorded', {
        firm,
        fingerprint: body.fingerprint,
      });
    }
    return jsonNoStore(result);
  });
}

export function revokeDecisionHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'revoke', async (request, env, params) => {
    const id = pathId(params);
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(RevokeDecisionRequestSchema, raw);
    const row = await decisionById(ctx, id);
    if (!row) throw new ProxyError('invalid_request', 'decision_not_found');
    const result: { ok: true; current: ActiveDecision | null } = { ok: true, current: null };
    RevokeDecisionResponseSchema.parse(result);
    const conflict = async (): Promise<never> => {
      const cur = await currentActive(ctx, row.law_firm_id, row.fingerprint);
      throw new ConflictError(cur ? toActiveDecision(cur) : null);
    };
    if (row.status !== 'active') {
      const r = await replayed(ctx, body.client_op_id);
      if (r) return replayResponse(ctx, body.client_op_id, 'decision_revoked');
      return conflict();
    }
    let res: D1Result[];
    try {
      res = await ctx.db.batch([
        auditStmt(
          ctx.db,
          ctx,
          {
            op: body.client_op_id,
            action: 'decision_revoked',
            lawFirmId: row.law_firm_id,
            entityType: 'decision',
            entityId: id,
            reason: maskFree(body.reason),
            detail: { decision: row.decision },
            result,
          },
          AUDIT_SQL.insertIfDecisionActive,
        ),
        revokeStmt(ctx.db, ctx, id, maskFree(body.reason)),
        reopenStateStmt(ctx.db, ctx, id),
      ]);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, 'decision_revoked');
    }
    if (Number(res[1]?.meta.changes ?? 0) === 0) {
      // lost a race: the row was superseded/revoked between the read and the batch
      const r = await replayed(ctx, body.client_op_id);
      if (r) return replayResponse(ctx, body.client_op_id, 'decision_revoked');
      return conflict();
    }
    return jsonNoStore(result);
  });
}
