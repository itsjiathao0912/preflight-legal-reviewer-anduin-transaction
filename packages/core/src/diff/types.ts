import { z } from 'zod';
import type { Finding } from '../findings/schema';
import type { DocGraph } from '../graph/graph';
import type { Structure } from '../structure/types';

/**
 * Phase 07 version / sibling diff contracts. `DiffResult` is plain JSON (Comlink-safe), sorted and
 * deterministic, and carries NO timing field (the worker wraps it as `{result, ms}`).
 *
 * Excerpts are span-aware clipped RAW text plus `sensitiveSpans` offsets into that exact string.
 * Core never masks here: the main thread applies the allow-listed `mask(text, sensitiveSpans)`.
 */

/** Failure stage of one diff side. Distinct from the web engine's `StageId` (E20). */
export const DIFF_STAGES = ['read', 'parse', 'structure', 'detect', 'diff'] as const;
export const DiffStageSchema = z.enum(DIFF_STAGES);
export type DiffStage = z.infer<typeof DiffStageSchema>;

export const DIFF_MODES = ['version', 'sibling'] as const;
export const DiffModeSchema = z.enum(DIFF_MODES);
export type DiffMode = z.infer<typeof DiffModeSchema>;

export type DiffSide = 'a' | 'b';

/** One prepared side: parsed document + deterministic findings, or a failed stage + code. */
export type SideInput =
  | { ok: true; structure: Structure; graph: DocGraph; findings: readonly Finding[] }
  | { ok: false; stage: DiffStage; code: string };

export interface DiffInput {
  a: SideInput;
  b: SideInput;
  mode: DiffMode;
}

const SpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export type DiffSpan = z.infer<typeof SpanSchema>;

/** Raw clipped excerpt; `clippedStart/End` say text was cut there (the UI draws the ellipsis). */
export const ExcerptSchema = z.object({
  text: z.string().max(2000),
  sensitiveSpans: z.array(SpanSchema),
  clippedStart: z.boolean(),
  clippedEnd: z.boolean(),
});
export type Excerpt = z.infer<typeof ExcerptSchema>;

/** One clause-diff segment. `gap` = unchanged text elided by clipping (empty text). */
export const SegmentSchema = z.object({
  op: z.enum(['same', 'del', 'add', 'gap']),
  text: z.string().max(2000),
  sensitiveSpans: z.array(SpanSchema),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const SECTION_STATUSES = [
  'added',
  'removed',
  'renamed',
  'moved',
  'changed',
  'same',
] as const;
export const SectionStatusSchema = z.enum(SECTION_STATUSES);
export type SectionStatus = z.infer<typeof SectionStatusSchema>;

export const UnitKindSchema = z.enum(['scope', 'section', 'part']);
export type UnitKind = z.infer<typeof UnitKindSchema>;

const PathSchema = z.array(z.string().max(300)).max(8);

export const SectionDiffSchema = z.object({
  status: SectionStatusSchema,
  kind: UnitKindSchema,
  keyA: z.string().optional(),
  keyB: z.string().optional(),
  pathA: PathSchema.optional(),
  pathB: PathSchema.optional(),
  titleA: z.string().max(300).optional(),
  titleB: z.string().max(300).optional(),
  a: ExcerptSchema.optional(),
  b: ExcerptSchema.optional(),
  /** Word-level clause diff (changed / renamed / moved pairs only). */
  segments: z.array(SegmentSchema).optional(),
  /** The text diff hit the edit bound and used the coarse whole-block replace (B2). */
  truncated: z.boolean(),
});
export type SectionDiff = z.infer<typeof SectionDiffSchema>;

export const DefinitionDiffSchema = z.object({
  term: z.string().max(80),
  status: z.enum(['added', 'removed', 'changed', 'renamed']),
  /** New term name when `status` is renamed. */
  termB: z.string().max(80).optional(),
  pathA: PathSchema.optional(),
  pathB: PathSchema.optional(),
  a: ExcerptSchema.optional(),
  b: ExcerptSchema.optional(),
});
export type DefinitionDiff = z.infer<typeof DefinitionDiffSchema>;

export const RequirementDiffSchema = z.object({
  status: z.enum(['added', 'removed']),
  path: PathSchema,
  excerpt: ExcerptSchema,
});
export type RequirementDiff = z.infer<typeof RequirementDiffSchema>;

export const FeeMentionSchema = z.object({
  percent: z.string().max(12),
  /** Share/unit class letter the fee applies to, when the text names one. */
  feeClass: z.string().max(4).optional(),
  path: PathSchema,
  excerpt: ExcerptSchema,
});
export type FeeMention = z.infer<typeof FeeMentionSchema>;

export const FeeDiffSchema = z.object({
  status: z.enum(['added', 'removed', 'changed', 'same']),
  a: FeeMentionSchema.optional(),
  b: FeeMentionSchema.optional(),
});
export type FeeDiff = z.infer<typeof FeeDiffSchema>;

export const RenameSchema = z.object({
  from: z.string().max(80),
  to: z.string().max(80),
  /** Same-position substitutions found in aligned text. */
  count: z.number().int().nonnegative(),
  /** Occurrences of `from` in the aligned old text (coverage denominator). */
  occurrences: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});
export type Rename = z.infer<typeof RenameSchema>;

export const PossibleLeftoverSchema = z.object({
  term: z.string().max(80),
  label: z.literal('Possible leftover'),
  severity: z.literal('low'),
  /** Capped at 0.4 by rule (AC16); diff-only, never a Finding. */
  confidence: z.number().min(0).max(0.4),
  countB: z.number().int().nonnegative(),
  cooccursWith: z.array(z.string().max(80)),
  b: ExcerptSchema.optional(),
});
export type PossibleLeftover = z.infer<typeof PossibleLeftoverSchema>;

export const DeltaRowSchema = z.object({
  detector_id: z.string().max(80),
  issue_class: z.string().max(60),
  severity: z.string().max(20),
  findingIdA: z.string().optional(),
  findingIdB: z.string().optional(),
  pathA: PathSchema.optional(),
  pathB: PathSchema.optional(),
  similarity: z.number().min(0).max(1).optional(),
  excerpt: ExcerptSchema,
});
export type DeltaRow = z.infer<typeof DeltaRowSchema>;

export const FindingsDeltaSchema = z.object({
  fixed: z.array(DeltaRowSchema),
  stillPresent: z.array(DeltaRowSchema),
  new: z.array(DeltaRowSchema),
});
export type FindingsDelta = z.infer<typeof FindingsDeltaSchema>;

export const CLAUSE_LABELS = ['common', 'differing', 'only_a', 'only_b'] as const;
export const ClauseLabelSchema = z.enum(CLAUSE_LABELS);
export type ClauseLabel = z.infer<typeof ClauseLabelSchema>;

export const ClauseSchema = z.object({
  label: ClauseLabelSchema,
  pathA: PathSchema.optional(),
  pathB: PathSchema.optional(),
  a: ExcerptSchema.optional(),
  b: ExcerptSchema.optional(),
  segments: z.array(SegmentSchema).optional(),
  truncated: z.boolean(),
});
export type Clause = z.infer<typeof ClauseSchema>;

const count = z.number().int().nonnegative();

export const DiffSummarySchema = z.object({
  sections: z.object({
    added: count,
    removed: count,
    renamed: count,
    moved: count,
    changed: count,
    same: count,
  }),
  findings: z.object({ fixed: count, stillPresent: count, new: count }),
  clauses: z.object({ common: count, differing: count, only_a: count, only_b: count }).optional(),
});
export type DiffSummary = z.infer<typeof DiffSummarySchema>;

export const DIFF_NOTICES = ['none', 'no_differences', 'not_enough_structure'] as const;

export const DiffResultSchema = z
  .object({
    mode: DiffModeSchema,
    notice: z.enum(DIFF_NOTICES),
    summary: DiffSummarySchema,
    sections: z.array(SectionDiffSchema),
    definitions: z.array(DefinitionDiffSchema),
    requirements: z.array(RequirementDiffSchema),
    fees: z.array(FeeDiffSchema),
    renames: z.array(RenameSchema),
    possibleLeftovers: z.array(PossibleLeftoverSchema),
    findingsDelta: FindingsDeltaSchema,
    clauses: z.array(ClauseSchema).optional(),
  })
  .strict();
export type DiffResult = z.infer<typeof DiffResultSchema>;

/** Failure payload: side + stage + code only — never message text or document text. */
export const DiffErrorSchema = z
  .object({
    side: z.enum(['a', 'b']),
    stage: DiffStageSchema,
    code: z.string().regex(/^[a-z_]{1,40}$/),
  })
  .strict();
export type DiffError = z.infer<typeof DiffErrorSchema>;

export type DiffOutcome = { result: DiffResult } | { error: DiffError };
