import { z } from 'zod';
import { limits } from '../config/limits';
import { IssueClassSchema } from '../findings/taxonomy';

/** AI envelope v1. Additive-only: new fields must be optional; `ext` is passthrough. */
const Ext = z.record(z.string(), z.unknown()).optional();

export const AiCandidateSchema = z.object({
  id: z.string().min(1).max(64),
  quote: z.string().min(1).max(limits.quoteMaxChars),
  section_path: z.array(z.string().max(300)).max(8),
  issue_class_hint: IssueClassSchema.optional(),
});

export const AiRequestSchema = z.object({
  v: z.literal(1),
  law_firm_id: z.string().min(1).max(64).nullable(),
  candidates: z.array(AiCandidateSchema).min(1).max(limits.aiCandidates),
  settings: z.object({ model_tier: z.string().max(40).optional() }),
  ext: Ext,
});
export type AiRequest = z.infer<typeof AiRequestSchema>;

export const AiFindingSchema = z.object({
  candidate_id: z.string().min(1).max(64),
  issue_class: IssueClassSchema,
  /** AI findings never exceed high. */
  severity: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  /** Model's quote; the client locates it in the document and snaps to the document sentence. */
  quote: z.string().min(1).max(limits.quoteMaxChars),
  explanation: z.string().min(1).max(1000),
  interpretations: z.array(z.string().min(1).max(500)).max(6).optional(),
});
export type AiFinding = z.infer<typeof AiFindingSchema>;

export const AiResultSchema = z.object({
  v: z.literal(1),
  findings: z.array(AiFindingSchema),
  usage: z
    .object({
      tokens_in: z.number().int().nonnegative().optional(),
      tokens_out: z.number().int().nonnegative().optional(),
    })
    .optional(),
  ext: Ext,
});
export type AiResult = z.infer<typeof AiResultSchema>;
