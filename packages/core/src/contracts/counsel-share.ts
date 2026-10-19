import { z } from 'zod';
import { SeveritySchema } from '../findings/severity';
import { IssueClassSchema } from '../findings/taxonomy';
import {
  ActiveDecisionSchema,
  AnswerScopeSchema,
  CounselOptionSchema,
  QuestionOwnerSchema,
} from './memory';

/**
 * Counsel share link contracts (additive, 19-10-26). The analyst shares one sandbox review with
 * outside counsel through a signed 7-day link; counsel joins with a typed name, answers and
 * comments. The frozen v1 contracts (claims, memory) are not edited by this module.
 */

const Id = z.string().min(1).max(64);
const ClientOpId = z.string().min(8).max(64);
const EpochMs = z.number().int().nonnegative();

/** Self-declared counsel name (stored masked; not an identity). */
export const COUNSEL_NAME_MAX = 80;
export const COUNSEL_COMMENT_MAX = 1000;
/** Share tokens longer than this are refused before decoding. */
export const SHARE_TOKEN_MAX = 1024;

export const CounselRoleSchema = z.enum(['analyst', 'counsel']);
export type CounselRole = z.infer<typeof CounselRoleSchema>;

/**
 * Bundled document reference bound to a share: `package:<id>` (public/samples/packages.json) or
 * `sample:<NN>`. Counsel's browser re-opens the same bundled files; documents are never stored.
 */
export const DOC_REF_RE = /^(package|sample):[a-z0-9-]{1,40}$/;
export const DOC_REF_MAX = 48;
export const DocRefSchema = z.string().max(DOC_REF_MAX).regex(DOC_REF_RE);
export type DocRef = z.infer<typeof DocRefSchema>;

/** Most active decisions returned by the counsel sheet. */
export const COUNSEL_SHEET_DECISIONS_MAX = 500;

/** POST /api/counsel/share (analyst only) */
export const CounselShareRequestSchema = z.object({ doc_ref: DocRefSchema });
export type CounselShareRequest = z.infer<typeof CounselShareRequestSchema>;
export const CounselShareResponseSchema = z.object({
  token: z.string().min(1).max(SHARE_TOKEN_MAX),
  expires_at: EpochMs,
});
export type CounselShareResponse = z.infer<typeof CounselShareResponseSchema>;

/** POST /api/counsel/join (no cookie; sets the counsel cookie) */
export const CounselJoinRequestSchema = z.object({
  token: z.string().min(1).max(SHARE_TOKEN_MAX),
  name: z
    .string()
    .max(COUNSEL_NAME_MAX)
    .refine((s) => s.trim().length > 0, { message: 'name required' }),
});
export const CounselJoinResponseSchema = z.object({
  workspace_id: Id,
  counsel_name: z.string().min(1).max(COUNSEL_NAME_MAX),
  expires_at: EpochMs,
  doc_ref: DocRefSchema,
});
export type CounselJoinRequest = z.infer<typeof CounselJoinRequestSchema>;
export type CounselJoinResponse = z.infer<typeof CounselJoinResponseSchema>;

/** One per-question comment (append-only). */
export const CounselCommentSchema = z.object({
  id: Id,
  question_id: Id,
  author_role: CounselRoleSchema,
  author_name: z.string().min(1).max(120),
  body: z.string().min(1).max(COUNSEL_COMMENT_MAX),
  created_at: EpochMs,
});
export type CounselComment = z.infer<typeof CounselCommentSchema>;

/** POST /api/counsel/comments (analyst or counsel cookie) */
export const CounselCommentPostSchema = z.object({
  question_id: Id,
  body: z
    .string()
    .max(COUNSEL_COMMENT_MAX)
    .refine((s) => s.trim().length > 0, { message: 'body required' }),
  client_op_id: ClientOpId,
});
export const CounselCommentPostResponseSchema = z.object({ comment: CounselCommentSchema });
export type CounselCommentPost = z.infer<typeof CounselCommentPostSchema>;
export type CounselCommentPostResponse = z.infer<typeof CounselCommentPostResponseSchema>;

/** GET /api/counsel/comments?question_id= */
export const CounselCommentListResponseSchema = z.object({
  comments: z.array(CounselCommentSchema),
});
export type CounselCommentListResponse = z.infer<typeof CounselCommentListResponseSchema>;

/**
 * A question row as the sheet returns it. Quote and location come from the persisted finding
 * (masked snippet, section path joined with " > "); absent when the finding was not persisted.
 * `fingerprint` is echoed so counsel can post an answer without the document.
 */
export const CounselSheetQuestionSchema = z.object({
  id: Id,
  finding_id: z.string().min(1).max(64),
  finding_key: z.string().min(1).max(64),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  issue_class: IssueClassSchema,
  severity: SeveritySchema.optional(),
  owner: QuestionOwnerSchema.optional(),
  location: z.string().max(2500).optional(),
  quote_masked: z.string().max(300).optional(),
  draft_text: z.string().max(2000).optional(),
  edited_text: z.string().max(2000).optional(),
  status: z.enum(['drafted', 'exported', 'answered']),
  interpretations: z.array(z.string().max(500)).max(6),
  created_at: EpochMs,
});
export type CounselSheetQuestion = z.infer<typeof CounselSheetQuestionSchema>;

/** An active answer row (counsel_answer columns). */
export const CounselSheetAnswerSchema = z.object({
  id: Id,
  question_id: Id,
  option: CounselOptionSchema,
  note: z.string().max(1000).optional(),
  answered_by_name: z.string().min(1).max(120),
  answered_at: EpochMs,
  intent: z.string().max(500).optional(),
  scope: AnswerScopeSchema.optional(),
});
export type CounselSheetAnswer = z.infer<typeof CounselSheetAnswerSchema>;

/** GET /api/counsel/sheet[?since=<ms>] (analyst or counsel cookie) */
export const CounselSheetResponseSchema = z.object({
  role: CounselRoleSchema,
  doc_ref: DocRefSchema,
  questions: z.array(CounselSheetQuestionSchema),
  answers: z.array(CounselSheetAnswerSchema),
  comments: z.array(CounselCommentSchema),
  /** Workspace ACTIVE decisions (closed / accepted states), matched to findings by fingerprint. */
  decisions: z.array(ActiveDecisionSchema).max(COUNSEL_SHEET_DECISIONS_MAX),
  ready_at: EpochMs.nullable(),
});
export type CounselSheetResponse = z.infer<typeof CounselSheetResponseSchema>;

/** POST /api/counsel/ready (analyst only) */
export const CounselReadyRequestSchema = z.object({ client_op_id: ClientOpId });
export const CounselReadyResponseSchema = z.object({ ready_at: EpochMs });
export type CounselReadyRequest = z.infer<typeof CounselReadyRequestSchema>;
export type CounselReadyResponse = z.infer<typeof CounselReadyResponseSchema>;
