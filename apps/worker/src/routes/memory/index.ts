// Phase 04b memory routes (fills the Phase 00 stub).
//
// A0 contract-fit (worker-side derivation; no core contract edit):
// - Decision firm: run_id -> review_run.law_firm_id; absent run_id -> 400 invalid_request
//   `run_required`. Unknown request keys (e.g. the web DecideInput.law_firm_id) are stripped by zod
//   and never stored.
// - Counsel question run: the latest run that contains the finding_ref (else the latest decision on
//   that finding, else the latest run). Answer firm and class come from the question row.
// - Create-rule firm: `?law_firm_id=` on POST /api/rules.
// - Analyst name: read from the `analyst` row (liveness query), never from the client.
// - counsel_question has its own `id`, returned as `question_id` (PK (workspace_id, id)).
// - Rule mapping: DB `proposed` origin -> contract `proposal`; `seed_of` set -> `seed`; DB `revoked`
//   excluded from lists (the revoke action reports `rejected`).
// - GET /api/memory/firm is canonical; GET /api/memory/firms/:id is the alias. GET /api/export is
//   the P1 stretch. POST /api/runs/:id/export uses a worker-local zod schema (Phase 08 note).
//
// Every route takes the workspace from the verified cookie only; memory routes never mint a
// cookie (only POST /api/session does).
import type { App, AppDeps } from '../../app';
import { memoryDeps } from '../../memory/http';
import { auditHandler } from './audit';
import { counselAnswerHandler, counselQuestionHandler } from './counsel';
import { createDecisionHandler, revokeDecisionHandler } from './decisions';
import { runExportHandler, workspaceExportHandler } from './export';
import { firmMemoryHandler } from './firm';
import { memoryHealthHandler } from './health';
import { lookupHandler } from './lookup';
import { createRuleHandler, listRulesHandler, ruleActionHandler } from './rules';
import { createRunHandler, storeFindingsHandler } from './runs';
import { sessionResetHandler } from './reset';
import { sessionHandler } from './session';
import {
  joinHandler,
  listCommentsHandler,
  postCommentHandler,
  readyHandler,
  shareHandler,
  sheetHandler,
} from './share';

/** The 04b route table (method, path), in registration order (+ counsel share link, 19-10-26). */
export const MEMORY_ROUTES = [
  'POST /api/session',
  'POST /api/session/reset',
  'POST /api/memory/lookup',
  'POST /api/runs',
  'POST /api/runs/:id/findings',
  'POST /api/runs/:id/export',
  'POST /api/decisions',
  'POST /api/decisions/:id/revoke',
  'POST /api/counsel/questions',
  'POST /api/counsel/answers',
  'POST /api/counsel/share',
  'POST /api/counsel/join',
  'GET /api/counsel/sheet',
  'GET /api/counsel/comments',
  'POST /api/counsel/comments',
  'POST /api/counsel/ready',
  'GET /api/rules',
  'POST /api/rules',
  'POST /api/rules/:id/approve',
  'POST /api/rules/:id/reject',
  'POST /api/rules/:id/revoke',
  'GET /api/memory/firm',
  'GET /api/memory/firms/:id',
  'GET /api/audit',
  'GET /api/export',
  'GET /api/memory/health',
] as const;

export function mountMemoryRoutes(app: App, deps: AppDeps): void {
  const d = memoryDeps(deps);
  app.route('POST', '/api/session', sessionHandler(d));
  app.route('POST', '/api/session/reset', sessionResetHandler(d));
  app.route('POST', '/api/memory/lookup', lookupHandler(d));
  app.route('POST', '/api/runs', createRunHandler(d));
  app.route('POST', '/api/runs/:id/findings', storeFindingsHandler(d));
  app.route('POST', '/api/runs/:id/export', runExportHandler(d));
  app.route('POST', '/api/decisions', createDecisionHandler(d));
  app.route('POST', '/api/decisions/:id/revoke', revokeDecisionHandler(d));
  app.route('POST', '/api/counsel/questions', counselQuestionHandler(d));
  app.route('POST', '/api/counsel/answers', counselAnswerHandler(d));
  app.route('POST', '/api/counsel/share', shareHandler(d));
  app.route('POST', '/api/counsel/join', joinHandler(d));
  app.route('GET', '/api/counsel/sheet', sheetHandler(d));
  app.route('GET', '/api/counsel/comments', listCommentsHandler(d));
  app.route('POST', '/api/counsel/comments', postCommentHandler(d));
  app.route('POST', '/api/counsel/ready', readyHandler(d));
  app.route('GET', '/api/rules', listRulesHandler(d));
  app.route('POST', '/api/rules', createRuleHandler(d));
  app.route('POST', '/api/rules/:id/approve', ruleActionHandler(d, 'approve'));
  app.route('POST', '/api/rules/:id/reject', ruleActionHandler(d, 'reject'));
  app.route('POST', '/api/rules/:id/revoke', ruleActionHandler(d, 'revoke'));
  app.route('GET', '/api/memory/firm', firmMemoryHandler(d));
  app.route('GET', '/api/memory/firms/:id', firmMemoryHandler(d));
  app.route('GET', '/api/audit', auditHandler(d));
  app.route('GET', '/api/export', workspaceExportHandler(d));
  app.route('GET', '/api/memory/health', memoryHealthHandler(d));
}
