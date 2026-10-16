import { z } from 'zod';
import { limits } from '../config/limits';
import { AnchorSchema, RegionSchema } from '../model/types';
import { SeveritySchema, severityRank, maxSeverityFor } from './severity';
import { IssueClassSchema } from './taxonomy';

const HEX64 = /^[0-9a-f]{64}$/;

export const FactValueSchema = z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]);

/** Explanation facts + interpretations (AC9; counsel items carry interpretations). */
export const FindingDetailSchema = z.object({
  /** One plain-language sentence: rule + facts used. */
  explanation: z.string().min(1).max(1000),
  facts: z.record(z.string(), FactValueSchema),
  interpretations: z.array(z.string().min(1).max(500)).max(6),
  /** Expected target / fix suggestion, when the rule knows it. */
  expected: z.string().max(300).optional(),
});
export type FindingDetail = z.infer<typeof FindingDetailSchema>;

const FindingBase = z.object({
  /** Engine-stable finding key (AC8). */
  id: z.string().min(1).max(64),
  issue_class: IssueClassSchema,
  severity: SeveritySchema,
  detector_kind: z.enum(['rule', 'ai']),
  detector_id: z.string().min(1).max(80),
  model: z.string().min(1).max(120).optional(),
  provenance: z.enum(['fresh', 'cache']).optional(),
  confidence: z.number().min(0).max(1),
  anchor: AnchorSchema,
  section_path: z.array(z.string().max(300)).max(8),
  page: z.number().int().positive().optional(),
  region: RegionSchema.optional(),
  /** Masked display/storage snippet. */
  quote_snippet: z.string().min(1).max(limits.snippetMaxChars),
  quote_hash: z.string().regex(HEX64),
  /** Optional: computed at lookup time with fingerprintFor (engine has no firm). */
  fingerprint: z.string().regex(HEX64).optional(),
  pattern_key: z.string().min(1).max(80).optional(),
  detail: FindingDetailSchema,
});

type FindingShape = z.infer<typeof FindingBase>;

function refineFinding(
  f: Pick<FindingShape, 'issue_class' | 'severity' | 'detector_kind' | 'model' | 'provenance'>,
  ctx: z.RefinementCtx,
) {
  if (severityRank(f.severity) > severityRank(maxSeverityFor(f.issue_class, f.detector_kind))) {
    ctx.addIssue({
      code: 'custom',
      message: `severity ${f.severity} exceeds cap for ${f.detector_kind}/${f.issue_class}`,
      path: ['severity'],
    });
  }
  if ((f.detector_kind === 'ai') !== (f.model !== undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: 'model is required iff detector_kind is ai',
      path: ['model'],
    });
  }
  if (f.detector_kind === 'rule' && f.provenance !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'provenance is for AI findings only',
      path: ['provenance'],
    });
  }
}

/** Client-side Finding: carries the full document sentence `quote` (never sent to the server except in decision/counsel writes). */
export const FindingSchema = FindingBase.extend({
  quote: z.string().min(1).max(limits.quoteMaxChars),
}).superRefine(refineFinding);
export type Finding = z.infer<typeof FindingSchema>;

/** Wire form for POST /api/runs/:id/findings: Finding minus `quote`, plus a required `fingerprint`. */
export const FindingWireSchema = FindingBase.extend({
  fingerprint: z.string().regex(HEX64),
}).superRefine(refineFinding);
export type FindingWire = z.infer<typeof FindingWireSchema>;

export function toWire(f: Finding, fingerprint: string): FindingWire {
  const { quote: _quote, ...rest } = f;
  return FindingWireSchema.parse({ ...rest, fingerprint });
}
