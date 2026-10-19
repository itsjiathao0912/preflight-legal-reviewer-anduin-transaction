import { z } from 'zod';
import { limits } from '../config/limits';
import { FindingWireSchema } from '../findings/schema';
import { IssueClassSchema } from '../findings/taxonomy';
import { OWNERS } from '../variance/types';
import { ErrorDetailSchema } from './errors';

/** Memory API contracts v1 (frozen at Phase 01 exit). */

const HEX64 = z.string().regex(/^[0-9a-f]{64}$/);
const Id = z.string().min(1).max(64);
const ClientOpId = z.string().min(8).max(64);
const Name = z.string().min(1).max(120);

/** MemoryLabel = the DATA-MODEL `memory_label` CHECK list (instruction E5). */
export const MEMORY_LABELS = [
  'new',
  'previously_dismissed',
  'dismissed_reconfirm',
  'already_answered',
  'awaiting_counsel',
] as const;
export const MemoryLabelSchema = z.enum(MEMORY_LABELS);
export type MemoryLabel = z.infer<typeof MemoryLabelSchema>;

/** Display aliases used in the plan text and UI copy. */
export const MEMORY_LABEL_ALIASES: Readonly<Record<MemoryLabel, string>> = Object.freeze({
  new: 'new',
  previously_dismissed: 'dismissed',
  dismissed_reconfirm: 'dismissed_reconfirm',
  already_answered: 'answered',
  awaiting_counsel: 'awaiting_counsel',
});

export const REASON_CODES = [
  'firm_standard_wording',
  'no_form_impact',
  'tool_false_alarm',
  'other',
] as const;
export const ReasonCodeSchema = z.enum(REASON_CODES);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

export const CounselOptionSchema = z.enum(['A', 'B', 'C', 'unclear']);
export type CounselOption = z.infer<typeof CounselOptionSchema>;

/** Variance (Phase 03): who should answer a question, and how that owner was chosen. */
export const QuestionOwnerSchema = z.enum(OWNERS);
export const OwnerSourceSchema = z.enum(['suggested', 'override']);
/** Variance (Phase 03): `fund` = this fund only; `firm_template` = the firm's standard template. */
export const AnswerScopeSchema = z.enum(['fund', 'firm_template']);
export type AnswerScope = z.infer<typeof AnswerScopeSchema>;
/** Variance (Phase 03): the one MVP regression assertion (label normalized server-side). */
export const AnswerAssertionSchema = z.object({
  kind: z.literal('scope_exists'),
  label: z.string().min(1).max(80),
});
export type AnswerAssertion = z.infer<typeof AnswerAssertionSchema>;
/** Variance (Phase 03): an active regression check returned inside the lookup response. */
export const RegressionCheckSummarySchema = z.object({
  id: Id,
  assertion_kind: z.literal('scope_exists'),
  assertion_key: z.string().min(1).max(80),
  statement_text: z.string().min(1).max(300),
  source_fund_name: z.string().max(200),
});
export type RegressionCheckSummary = z.infer<typeof RegressionCheckSummarySchema>;

export const DecisionKindSchema = z.enum(['dismissed', 'accepted', 'answered']);
export const DecisionStatusSchema = z.enum(['active', 'superseded', 'revoked']);

export const ActiveDecisionSchema = z.object({
  id: Id,
  fingerprint: HEX64,
  status: DecisionStatusSchema,
  decision: DecisionKindSchema,
  reason_code: ReasonCodeSchema.optional(),
  note: z.string().max(500).optional(),
  counsel_option: CounselOptionSchema.optional(),
  counsel_note: z.string().max(1000).optional(),
  issue_class: IssueClassSchema.optional(),
  quote_snippet: z.string().max(limits.snippetMaxChars).optional(),
  section_path: z.array(z.string().max(300)).max(8).optional(),
  pattern_key: z.string().max(80).optional(),
  fund_name: z.string().max(200),
  doc_version_label: z.string().max(120).optional(),
  intent: z.string().max(limits.intentMaxChars).optional(),
  scope: AnswerScopeSchema.optional(),
  decided_by_name: Name,
  decided_at: z.number().int().nonnegative(),
});
export type ActiveDecision = z.infer<typeof ActiveDecisionSchema>;

/** POST /api/memory/lookup */
export const MemoryLookupRequestSchema = z.object({
  law_firm_id: z.string().min(1).max(64),
  fingerprints: z.array(HEX64).min(1).max(limits.memoryLookupMax),
});
export const MemoryLookupResponseSchema = z.object({
  decisions: z.array(ActiveDecisionSchema),
  regression_checks: z
    .array(RegressionCheckSummarySchema)
    .max(limits.regressionChecksPerFirm)
    .optional(),
});
export type MemoryLookupRequest = z.infer<typeof MemoryLookupRequestSchema>;
export type MemoryLookupResponse = z.infer<typeof MemoryLookupResponseSchema>;

/** POST /api/runs */
export const CreateRunRequestSchema = z.object({
  client_op_id: ClientOpId,
  doc_name: z.string().min(1).max(120),
  doc_hash: HEX64,
  law_firm_id: z.string().min(1).max(64).nullable(),
  fund_name: z.string().min(1).max(200).optional(),
  version_label: z.string().min(1).max(120).optional(),
  settings_hash: HEX64,
});
export const CreateRunResponseSchema = z.object({ run_id: Id });
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type CreateRunResponse = z.infer<typeof CreateRunResponseSchema>;

/** POST /api/runs/:id/findings */
export const StoreFindingsRequestSchema = z.object({
  client_op_id: ClientOpId,
  findings: z.array(FindingWireSchema).min(1).max(limits.findingsChunk),
});
export const StoreFindingsResponseSchema = z.object({ stored: z.number().int().nonnegative() });
export type StoreFindingsRequest = z.infer<typeof StoreFindingsRequestSchema>;
export type StoreFindingsResponse = z.infer<typeof StoreFindingsResponseSchema>;

/** POST /api/decisions (server recomputes the fingerprint from quote_text -> 422 fingerprint_mismatch). */
export const CreateDecisionRequestSchema = z
  .object({
    client_op_id: ClientOpId,
    run_id: Id.optional(),
    finding_ref: Id,
    decision: z.enum(['dismissed', 'accepted']),
    reason_code: ReasonCodeSchema.optional(),
    note: z.string().max(500).optional(),
    quote_text: z.string().min(1).max(limits.quoteMaxChars),
    fingerprint: HEX64,
    issue_class: IssueClassSchema,
    pattern_key: z.string().max(80).optional(),
    fund_name: z.string().min(1).max(200).optional(),
    doc_version_label: z.string().max(120).optional(),
  })
  .refine((d) => d.decision !== 'dismissed' || d.reason_code !== undefined, {
    message: 'dismissed requires reason_code',
    path: ['reason_code'],
  });
export const CreateDecisionResponseSchema = z.object({ decision: ActiveDecisionSchema });
export type CreateDecisionRequest = z.infer<typeof CreateDecisionRequestSchema>;
export type CreateDecisionResponse = z.infer<typeof CreateDecisionResponseSchema>;

/** 409 conflict_active_decision body: the shared error plus the current active decision. */
export const ConflictBodySchema = z.object({
  error: ErrorDetailSchema,
  current: ActiveDecisionSchema.nullable(),
});
export type ConflictBody = z.infer<typeof ConflictBodySchema>;

/** POST /api/decisions/:id/revoke */
export const RevokeDecisionRequestSchema = z.object({
  client_op_id: ClientOpId,
  reason: z.string().min(1).max(500),
});
export const RevokeDecisionResponseSchema = z.object({
  ok: z.literal(true),
  current: ActiveDecisionSchema.nullable(),
});
export type RevokeDecisionRequest = z.infer<typeof RevokeDecisionRequestSchema>;
export type RevokeDecisionResponse = z.infer<typeof RevokeDecisionResponseSchema>;

/** POST /api/counsel/questions */
export const CounselQuestionRequestSchema = z.object({
  client_op_id: ClientOpId,
  finding_ref: Id,
  fingerprint: HEX64,
  interpretations: z.array(z.string().min(1).max(500)).min(1).max(6),
  owner: QuestionOwnerSchema.optional(),
  owner_source: OwnerSourceSchema.optional(),
});
export const CounselQuestionResponseSchema = z.object({ question_id: Id });
export type CounselQuestionRequest = z.infer<typeof CounselQuestionRequestSchema>;
export type CounselQuestionResponse = z.infer<typeof CounselQuestionResponseSchema>;

/** POST /api/counsel/answers */
export const CounselAnswerRequestSchema = z
  .object({
    client_op_id: ClientOpId,
    question_id: Id,
    option: CounselOptionSchema,
    note: z.string().max(1000).optional(),
    quote_text: z.string().min(1).max(limits.quoteMaxChars),
    fingerprint: HEX64,
    intent: z.string().max(limits.intentMaxChars).optional(),
    scope: AnswerScopeSchema.optional(),
    assertion: AnswerAssertionSchema.optional(),
  })
  .refine((a) => a.scope !== 'firm_template' || (a.intent ?? '').trim().length > 0, {
    message: 'firm_template requires a non-blank intent',
    path: ['intent'],
  })
  .refine((a) => a.assertion === undefined || a.scope === 'firm_template', {
    message: 'assertion requires scope firm_template',
    path: ['assertion'],
  });
export const CounselAnswerResponseSchema = z.object({
  answer_id: Id,
  decision: ActiveDecisionSchema,
});
export type CounselAnswerRequest = z.infer<typeof CounselAnswerRequestSchema>;
export type CounselAnswerResponse = z.infer<typeof CounselAnswerResponseSchema>;

/** Firm rules */
export const RuleSchema = z.object({
  id: Id,
  text: z.string().min(1).max(500),
  status: z.enum(['proposed', 'active', 'rejected']),
  origin: z.enum(['proposal', 'manual', 'seed']),
  evidence_count: z.number().int().nonnegative(),
});
export type Rule = z.infer<typeof RuleSchema>;

export const LawFirmQuerySchema = z.object({ law_firm_id: z.string().min(1).max(64) });
export const RulesResponseSchema = z.object({ rules: z.array(RuleSchema) });
export const RuleActionRequestSchema = z.object({
  client_op_id: ClientOpId,
  text: z.string().min(1).max(500).optional(),
});
export const RuleActionResponseSchema = z.object({ rule: RuleSchema });
export type RulesResponse = z.infer<typeof RulesResponseSchema>;
export type RuleActionRequest = z.infer<typeof RuleActionRequestSchema>;
export type RuleActionResponse = z.infer<typeof RuleActionResponseSchema>;

/** GET /api/memory/firm */
export const FirmMemoryResponseSchema = z.object({
  decisions: z.array(ActiveDecisionSchema),
  rules: z.array(RuleSchema),
  counts: z.object({
    decisions: z.number().int().nonnegative(),
    dismissed: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative(),
    awaiting: z.number().int().nonnegative(),
    rules_active: z.number().int().nonnegative(),
    rules_proposed: z.number().int().nonnegative(),
  }),
});
export type FirmMemoryResponse = z.infer<typeof FirmMemoryResponseSchema>;

/** Audit */
export const AUDIT_ACTIONS = [
  'session_created',
  'decision_recorded',
  'decision_revoked',
  'answer_recorded',
  'rule_added',
  'rule_proposed',
  'rule_approved',
  'rule_rejected',
  'rule_revoked',
  'counsel_sheet_exported',
  'regression_check_created',
  // counsel share link (additive, 19-10-26): the analyst marks the sheet ready to digitize
  'ready_to_digitize',
  // counsel joined the share link (actor_name = typed counsel name; no DB CHECK on action)
  'counsel_joined',
] as const;
export const AuditEventSchema = z.object({
  id: Id,
  at: z.number().int().nonnegative(),
  actor_name: Name,
  action: z.enum(AUDIT_ACTIONS),
  law_firm_id: z.string().max(64).optional(),
  entity_type: z.string().max(40).optional(),
  entity_id: z.string().max(64).optional(),
  reason: z.string().max(500).optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100),
  cursor: z.string().max(128).optional(),
});
export const AuditResponseSchema = z.object({
  events: z.array(AuditEventSchema),
  next_cursor: z.string().max(128).optional(),
});
export type AuditResponse = z.infer<typeof AuditResponseSchema>;

/** GET /api/export */
export const ExportResponseSchema = z.object({
  export_version: z.literal(1),
  decisions: z.array(ActiveDecisionSchema),
  rules: z.array(RuleSchema),
  audit: z.array(AuditEventSchema),
});
export type ExportResponse = z.infer<typeof ExportResponseSchema>;
