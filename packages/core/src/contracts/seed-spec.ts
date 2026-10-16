import { z } from 'zod';
import { IssueClassSchema } from '../findings/taxonomy';
import { CounselOptionSchema, ReasonCodeSchema } from './memory';

/**
 * DemoSeedSpec v1: the input for the demo seed generator (Phase 04b) and the
 * fixture `fixtures/memory/demo-seed-spec.json` (Phase 02). Fingerprints are
 * computed by core code from `quote` at generation time, never hand-written.
 */
export const DemoSeedDecisionSchema = z
  .object({
    id: z.string().min(1).max(64),
    law_firm_id: z.string().min(1).max(64),
    sample_id: z.string().min(1).max(64),
    issue_class: IssueClassSchema,
    quote: z.string().min(1).max(1000),
    sensitive_spans: z
      .array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }))
      .optional(),
    decision: z.enum(['dismissed', 'accepted', 'answered']),
    reason_code: ReasonCodeSchema.optional(),
    note: z.string().max(500).optional(),
    counsel_option: CounselOptionSchema.optional(),
    counsel_note: z.string().max(1000).optional(),
    pattern_key: z.string().max(80).optional(),
    section_path: z.array(z.string().max(300)).max(8).optional(),
    fund_name: z.string().min(1).max(200),
    doc_version_label: z.string().max(120).optional(),
    decided_by_name: z.string().min(1).max(120),
    decided_at: z.number().int().nonnegative(),
  })
  .refine((d) => d.decision !== 'dismissed' || d.reason_code !== undefined, {
    message: 'dismissed requires reason_code',
  })
  .refine((d) => d.decision !== 'answered' || d.counsel_option !== undefined, {
    message: 'answered requires counsel_option',
  });

export const DemoSeedSpecSchema = z.object({
  version: z.literal(1),
  workspace: z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(120) }),
  decisions: z.array(DemoSeedDecisionSchema),
  rules: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        law_firm_id: z.string().min(1).max(64),
        text: z.string().min(1).max(500),
        status: z.enum(['proposed', 'active', 'rejected']),
        pattern_key: z.string().max(80).optional(),
      }),
    )
    .default([]),
});
export type DemoSeedSpec = z.infer<typeof DemoSeedSpecSchema>;
