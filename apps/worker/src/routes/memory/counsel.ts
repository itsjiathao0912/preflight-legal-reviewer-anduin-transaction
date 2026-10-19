// POST /api/counsel/questions and POST /api/counsel/answers.
// A0: the question's run is the latest run that contains the finding_ref (persisted finding), else
// the run of the latest decision on that finding, else the latest run of the workspace; its firm
// must be set. The answer's firm and class come from the question row. An answer writes a
// superseding `answered` decision (option + note denormalized) so lookup stays a one-table read.
// Variance (Phase 03): a question may carry owner/owner_source (written once, ON CONFLICT DO
// NOTHING); an answer may carry intent/scope (masked like `note`) and, with scope firm_template
// only, an assertion that creates ONE regression_check in the same batch. Every isolation field is
// server-derived: workspace from the cookie, firm from the question row, fund from the run.
import { counselAnswerWeight } from '../../platform/index';
import {
  CounselAnswerRequestSchema,
  CounselAnswerResponseSchema,
  CounselQuestionRequestSchema,
  CounselQuestionResponseSchema,
  describeAssertion,
  IssueClassSchema,
  limits,
  normalizeAssertionLabel,
  parseQuestionKey,
  quoteHash,
} from '@aduin/core';
import type { Handler } from '../../app';
import { ProxyError, jsonNoStore } from '../../proxy/errors';
import { newId } from '../../db/ids';
import {
  counselPostEntry,
  handle,
  ok,
  parseWith,
  postEntry,
  type MemoryDeps,
} from '../../memory/http';
import type { MemoryCtx } from '../../memory/ctx';
import { maskFree, maskOpt, snippetOf } from '../../memory/mask';
import { auditStmt, replayed } from '../../memory/repo/audit';
import { countActiveChecks, insertRegressionCheckStmt } from '../../memory/repo/regression';
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
import { fingerprintOk, onBatchError, replayResponse } from './decisions';

/** Separator of the derived audit op id of a created check; '#' is outside ID_RE (N4). */
export const CHECK_OP_SUFFIX = '#rc';

/** True when a masked intent has no human text left (whitespace and mask tokens only). */
export function intentIsBlank(masked: string | null): boolean {
  return (masked ?? '').replace(/#\d{0,4}/g, '').trim().length === 0;
}

export function counselQuestionHandler(deps: MemoryDeps): Handler {
  return handle(deps, 'counsel_questions', async (request, env) => {
    const { ctx, raw } = await postEntry(request, env, deps.now(), { write: true });
    const body = parseWith(CounselQuestionRequestSchema, raw, { questionKey: true });
    // Variance (H2(d)): `finding_ref` may be a question key `<findingId>@<owner>`; the finding, run
    // and issue class resolve from the plain finding id, the key itself stays the question key.
    const parsedKey = parseQuestionKey(body.finding_ref);
    const findingId = parsedKey.findingId;
    // the key's `@owner` suffix is authoritative: a different body.owner is refused
    if (parsedKey.owner && body.owner && body.owner !== parsedKey.owner)
      throw new ProxyError('invalid_request', 'owner_key_mismatch');
    const owner = parsedKey.owner ?? body.owner ?? null;
    const withFinding = await ctx.db
      .prepare(RUN_SQL.latestWithFinding)
      .bind(ctx.workspaceId, findingId)
      .first<{ id: string; issue_class: string }>();
    let runId = withFinding?.id ?? null;
    if (!runId) {
      const byDecision = await ctx.db
        .prepare(RUN_SQL.latestByDecisionOrigin)
        .bind(ctx.workspaceId, findingId)
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
      owner,
      ownerSource: owner ? (body.owner_source ?? 'suggested') : null,
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
    // Counsel share link: the counsel cookie is accepted here (fund-scope answers only).
    const { ctx, raw } = await counselPostEntry(request, env, deps.now(), {
      weight: counselAnswerWeight,
    });
    const body = parseWith(CounselAnswerRequestSchema, raw);
    const isCounsel = ctx.actor === 'counsel';
    if (isCounsel && (body.assertion || body.scope === 'firm_template'))
      throw new ProxyError('invalid_request', 'counsel_scope');
    // N1/E1: a replay of an already-recorded answer returns the stored result BEFORE any cap
    // pre-check, so a replay at the cap never turns into regression_check_cap.
    if (body.assertion && (await replayed(ctx, body.client_op_id)))
      return replayResponse(ctx, body.client_op_id, 'answer_recorded');
    const q = await questionById(ctx, body.question_id);
    if (!q) throw new ProxyError('invalid_request', 'question_not_found');
    // Counsel has no document: the quote comes from the persisted finding (or the prior decision),
    // never from the body; the fingerprint must still equal the question's.
    if (
      body.fingerprint !== q.fingerprint ||
      (!isCounsel &&
        !fingerprintOk(body.quote_text, q.law_firm_id, q.issue_class, body.fingerprint))
    )
      throw new ProxyError('fingerprint_mismatch');
    const run = await runContext(ctx, q.review_run_id);
    if (!run) throw new ProxyError('invalid_request', 'run_not_found');
    const prev = await currentActive(ctx, q.law_firm_id, q.fingerprint);
    const quote = isCounsel
      ? await storedQuote(ctx, q, prev)
      : { hash: quoteHash(body.quote_text), snippet: snippetOf(body.quote_text) };
    const answerId = newId('ca', ctx.now);
    const note = maskOpt(body.note);
    const intent = maskOpt(body.intent);
    const scope = body.scope ?? null;
    if (scope === 'firm_template' && intentIsBlank(intent))
      throw new ProxyError('invalid_request', 'intent_required');
    let check: { key: string; statement: string } | null = null;
    if (body.assertion) {
      if (scope !== 'firm_template') throw new ProxyError('invalid_request', 'assertion_scope');
      const key = normalizeAssertionLabel(maskFree(body.assertion.label));
      if (key.length < 1 || key.length > 80)
        throw new ProxyError('invalid_request', 'assertion_label');
      const statement = describeAssertion({ kind: 'scope_exists', label: key });
      if (statement.length > 300) throw new ProxyError('invalid_request', 'assertion_label');
      if ((await countActiveChecks(ctx, q.law_firm_id)) >= limits.regressionChecksPerFirm)
        throw new ProxyError('invalid_request', 'regression_check_cap');
      check = { key, statement };
    }
    const d: NewDecision = {
      id: newId('dc', ctx.now),
      law_firm_id: q.law_firm_id,
      fingerprint: q.fingerprint,
      issue_class: q.issue_class,
      pattern_key: prev?.pattern_key ?? null,
      quote_hash: quote.hash,
      quote_snippet: quote.snippet,
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
      intent,
      scope,
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
          // ids and enums only: scope and the intent LENGTH, never the intent text
          detail: {
            option: body.option,
            question_id: q.id,
            decision_id: d.id,
            ...(scope ? { scope } : {}),
            ...(intent !== null ? { intent_len: intent.length } : {}),
            ...(isCounsel ? { actor: 'counsel' } : {}),
          },
          result,
        }),
        insertAnswerStmt(ctx.db, ctx, {
          id: answerId,
          questionId: q.id,
          option: body.option,
          note,
          intent,
          scope,
          ...(isCounsel && ctx.counselName ? { answeredBy: ctx.counselName } : {}),
        }),
        ...(check ? checkStmts(ctx, body.client_op_id, q.law_firm_id, answerId, run, check) : []),
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

/**
 * Counsel answers (share link): the quote of the persisted finding (plain finding id of the question
 * key), else the quote of the prior decision on the same fingerprint; neither -> 400.
 */
async function storedQuote(
  ctx: MemoryCtx,
  q: { review_run_id: string; finding_key: string },
  prev: { id: string } | null,
): Promise<{ hash: string; snippet: string }> {
  const f = await ctx.db
    .prepare(COUNSEL_SQL.findingQuote)
    .bind(ctx.workspaceId, q.review_run_id, parseQuestionKey(q.finding_key).findingId)
    .first<{ quote_hash: string; quote_snippet: string }>();
  if (f) return { hash: f.quote_hash, snippet: f.quote_snippet };
  if (prev) {
    const d = await ctx.db
      .prepare(COUNSEL_SQL.decisionQuote)
      .bind(ctx.workspaceId, prev.id)
      .first<{ quote_hash: string; quote_snippet: string }>();
    if (d) return { hash: d.quote_hash, snippet: d.quote_snippet };
  }
  throw new ProxyError('invalid_request', 'quote_unavailable');
}

/** The check row (FK to the answer inserted just before it) and its own audit row. */
function checkStmts(
  ctx: Parameters<typeof insertRegressionCheckStmt>[1],
  op: string,
  firm: string,
  answerId: string,
  run: { fund_name: string },
  check: { key: string; statement: string },
): D1PreparedStatement[] {
  const id = newId('rc', ctx.now);
  return [
    insertRegressionCheckStmt(ctx.db, ctx, {
      id,
      lawFirmId: firm,
      sourceAnswerId: answerId,
      sourceFundName: run.fund_name,
      assertionKey: check.key,
      statementText: check.statement,
    }),
    auditStmt(ctx.db, ctx, {
      op: `${op}${CHECK_OP_SUFFIX}`,
      action: 'regression_check_created',
      lawFirmId: firm,
      entityType: 'regression_check',
      entityId: id,
      detail: { assertion_kind: 'scope_exists', source_answer_id: answerId },
    }),
  ];
}
