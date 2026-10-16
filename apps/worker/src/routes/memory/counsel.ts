// POST /api/counsel/questions and POST /api/counsel/answers.
// A0: the question's run is the latest run that contains the finding_ref (persisted finding), else
// the run of the latest decision on that finding, else the latest run of the workspace; its firm
// must be set. The answer's firm and class come from the question row. An answer writes a
// superseding `answered` decision (option + note denormalized) so lookup stays a one-table read.
import {
  CounselAnswerRequestSchema,
  CounselAnswerResponseSchema,
  CounselQuestionRequestSchema,
  CounselQuestionResponseSchema,
  IssueClassSchema,
  quoteHash,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { newId } from '../../db/ids';
import { memoryCtx } from '../../memory/ctx';
import { handle, ok, parseWith, readJsonBody, type MemoryDeps } from '../../memory/http';
import { maskFree, maskOpt, snippetOf } from '../../memory/mask';
import { auditStmt } from '../../memory/repo/audit';
import {
  COUNSEL_SQL,
  insertAnswerStmt,
  insertQuestionStmt,
  questionById,
  questionId,
} from '../../memory/repo/counsel';
import {
  currentActive,
  insertDecisionStmt,
  newDecisionView,
  supersedeStmt,
  type NewDecision,
} from '../../memory/repo/decision';
import { upsertStateStmt } from '../../memory/repo/finding';
import { RUN_SQL, runContext } from '../../memory/repo/run';
import { fingerprintOk, onBatchError } from './decisions';

export function counselQuestionHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_questions', async (request, env) => {
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(CounselQuestionRequestSchema, raw);
    const withFinding = await ctx.db
      .prepare(RUN_SQL.latestWithFinding)
      .bind(ctx.workspaceId, body.finding_ref)
      .first<{ id: string; issue_class: string }>();
    let runId = withFinding?.id ?? null;
    if (!runId) {
      const byDecision = await ctx.db
        .prepare(RUN_SQL.latestByDecisionOrigin)
        .bind(ctx.workspaceId, body.finding_ref)
        .first<{ id: string }>();
      runId = byDecision?.id ?? null;
    }
    if (!runId) {
      const latest = await ctx.db
        .prepare(RUN_SQL.latest)
        .bind(ctx.workspaceId)
        .first<{ id: string }>();
      runId = latest?.id ?? null;
    }
    if (!runId) throw new ProxyError('invalid_request', 'run_required');
    const run = await runContext(ctx, runId);
    if (!run?.law_firm_id) throw new ProxyError('invalid_request', 'firm_required');
    let issueClass = withFinding?.issue_class ?? null;
    if (!issueClass) {
      const d = await currentActive(ctx, run.law_firm_id, body.fingerprint);
      issueClass = d?.issue_class ?? null;
    }
    const cls = IssueClassSchema.safeParse(issueClass);
    if (!cls.success) throw new ProxyError('invalid_request', 'issue_class_unknown');
    const id = questionId(ctx.workspaceId, run.id, body.finding_ref);
    await insertQuestionStmt(ctx.db, ctx, {
      id,
      runId: run.id,
      findingKey: body.finding_ref,
      fingerprint: body.fingerprint,
      firm: run.law_firm_id,
      issueClass: cls.data,
      interpretations: body.interpretations.map(maskFree),
    }).run();
    // an existing question for (run, finding_key) keeps its id (idempotent)
    const row = await ctx.db
      .prepare(COUNSEL_SQL.questionByRunKey)
      .bind(ctx.workspaceId, run.id, body.finding_ref)
      .first<{ id: string }>();
    return ok(CounselQuestionResponseSchema, { question_id: row?.id ?? id });
  });
}

export function counselAnswerHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_answers', async (request, env) => {
    const raw = await readJsonBody(request);
    const ctx = await memoryCtx(request, env, deps.now(), { write: true });
    const body = parseWith(CounselAnswerRequestSchema, raw);
    const q = await questionById(ctx, body.question_id);
    if (!q) throw new ProxyError('invalid_request', 'question_not_found');
    if (
      body.fingerprint !== q.fingerprint ||
      !fingerprintOk(body.quote_text, q.law_firm_id, q.issue_class, body.fingerprint)
    )
      throw new ProxyError('fingerprint_mismatch');
    const run = await runContext(ctx, q.review_run_id);
    if (!run) throw new ProxyError('invalid_request', 'run_not_found');
    const prev = await currentActive(ctx, q.law_firm_id, q.fingerprint);
    const answerId = newId('ca', ctx.now);
    const note = maskOpt(body.note);
    const d: NewDecision = {
      id: newId('dc', ctx.now),
      law_firm_id: q.law_firm_id,
      fingerprint: q.fingerprint,
      issue_class: q.issue_class,
      pattern_key: prev?.pattern_key ?? null,
      quote_hash: quoteHash(body.quote_text),
      quote_snippet: snippetOf(body.quote_text),
      section_path: null,
      fund_name: run.fund_name,
      doc_version_label: run.version_label,
      origin_fund_id: run.fund_id,
      origin_document_id: run.document_id,
      origin_review_run_id: run.id,
      origin_finding_key: q.finding_key,
      decision: 'answered',
      reason_code: null,
      note: null,
      counsel_option: body.option,
      counsel_note: note,
      counsel_answer_id: answerId,
      supersedes_id: prev ? prev.id : null,
    };
    const result = { answer_id: answerId, decision: newDecisionView(ctx, d) };
    CounselAnswerResponseSchema.parse(result);
    try {
      await ctx.db.batch([
        auditStmt(ctx.db, ctx, {
          op: body.client_op_id,
          action: 'answer_recorded',
          lawFirmId: q.law_firm_id,
          entityType: 'counsel_answer',
          entityId: answerId,
          detail: { option: body.option, question_id: q.id, decision_id: d.id },
          result,
        }),
        insertAnswerStmt(ctx.db, ctx, {
          id: answerId,
          questionId: q.id,
          option: body.option,
          note,
        }),
        ...(prev ? [supersedeStmt(ctx.db, ctx, prev.id, d.id)] : []),
        insertDecisionStmt(ctx.db, ctx, d),
        ctx.db.prepare(COUNSEL_SQL.markAnswered).bind(ctx.workspaceId, q.id),
        upsertStateStmt(ctx.db, ctx, {
          runId: run.id,
          findingKey: q.finding_key,
          status: 'answered',
          needsCounsel: false,
          decisionId: d.id,
        }),
      ]);
    } catch (e) {
      return onBatchError(e, ctx, body.client_op_id, 'answer_recorded', {
        firm: q.law_firm_id,
        fingerprint: q.fingerprint,
      });
    }
    return jsonNoStore(result);
  });
}
