import { z } from 'zod';

/**
 * Fund package intake (Phase 1) data model. Strict zod schemas are the source of truth; the
 * inferred types are the frozen contract consumed by the web phases. No timestamps, no clock ids.
 */
export const PACKAGE_DOC_TYPES = [
  'sub_agreement',
  'lpa',
  'ppm',
  'tax_form',
  'side_letter',
  'other',
] as const;
export const PACKAGE_DOC_ROLES = ['to_digitize', 'reference', 'baseline'] as const;

export const PackageDocTypeSchema = z.enum(PACKAGE_DOC_TYPES);
export type PackageDocType = z.infer<typeof PackageDocTypeSchema>;
export const PackageDocRoleSchema = z.enum(PACKAGE_DOC_ROLES);
export type PackageDocRole = z.infer<typeof PackageDocRoleSchema>;
export const PackageConfidenceSchema = z.enum(['high', 'low']);
export type PackageConfidence = z.infer<typeof PackageConfidenceSchema>;
export const SuggestionSourceSchema = z.enum(['rule', 'analyst', 'ai']);
export type SuggestionSource = z.infer<typeof SuggestionSourceSchema>;
/** Named `PackageDocFormat` so it never shadows the adapters' `DocFormat`. */
export const PackageDocFormatSchema = z.enum(['html', 'pdf', 'docx', 'ocr', 'image']);
export type PackageDocFormat = z.infer<typeof PackageDocFormatSchema>;

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);

export const PackageDocumentSchema = z.strictObject({
  id: Hex64,
  name: z.string().min(1).max(255),
  type: PackageDocTypeSchema,
  role: PackageDocRoleSchema,
  confidence: PackageConfidenceSchema,
  reason: z.string().max(300),
  confirmed: z.boolean(),
  suggestionSource: SuggestionSourceSchema,
  needsOcr: z.boolean(),
  format: PackageDocFormatSchema,
  titleLines: z.array(z.string().max(200)).max(12),
});
export type PackageDocument = z.infer<typeof PackageDocumentSchema>;

export const DocLocationSchema = z.strictObject({
  blockIndex: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  sectionPath: z.array(z.string()),
  page: z.number().int().positive().optional(),
});
export type DocLocation = z.infer<typeof DocLocationSchema>;

/**
 * Source File traceability (additive): a numbered part of a package document ("3.2 Permitted
 * Uses", "Section 7 Transfers"). Only labels that occur once in the document are kept.
 */
export const PackagePartSchema = z.strictObject({
  label: z.string().min(1).max(12),
  title: z.string().max(80),
  blockIndex: z.number().int().nonnegative(),
});
export type PackagePart = z.infer<typeof PackagePartSchema>;

export const CrossDocDefinitionSchema = z.strictObject({
  docId: Hex64,
  term: z.string().min(1).max(120),
  quote: z.string().max(240),
  location: DocLocationSchema,
  /** Additive: label of the numbered part holding the definition ("1.1"), when known. */
  sectionLabel: z.string().min(1).max(12).optional(),
  /** Additive: 1-based paragraph inside that part (the part's own block is paragraph 1). */
  paragraph: z.number().int().positive().optional(),
});
export type CrossDocDefinition = z.infer<typeof CrossDocDefinitionSchema>;

/** Additive: where a cross-document term is defined inside its defining document. */
export const DefinitionLocationSchema = z.strictObject({
  blockIndex: z.number().int().nonnegative(),
  sectionPath: z.array(z.string()),
  sectionLabel: z.string().min(1).max(12).optional(),
  paragraph: z.number().int().positive().optional(),
});
export type DefinitionLocation = z.infer<typeof DefinitionLocationSchema>;

export const PackageFactsSchema = z.strictObject({
  contentHash: Hex64,
  name: z.string().min(1).max(255),
  format: PackageDocFormatSchema,
  bytes: z.number().int().nonnegative(),
  needsOcr: z.boolean(),
  titleLines: z.array(z.string().max(200)).max(12),
  headText: z.string().max(1500),
  headings: z.array(z.string().max(120)).max(200),
  definitions: z.array(CrossDocDefinitionSchema),
  /** Additive (Source File): unique numbered parts; absent on facts cached before it existed. */
  parts: z.array(PackagePartSchema).max(400).optional(),
});
export type PackageFacts = z.infer<typeof PackageFactsSchema>;

export const TargetFamilySchema = z.enum(['lpa', 'ppm', 'side_letter', 'tax_form', 'annex']);
export type TargetFamily = z.infer<typeof TargetFamilySchema>;

export const RawReferenceSchema = z.strictObject({
  quote: z.string().min(1).max(240),
  location: DocLocationSchema,
  targetLabel: z.string().min(1).max(80),
  targetKey: z.string().min(1).max(80),
  targetFamily: TargetFamilySchema,
});
export type RawReference = z.infer<typeof RawReferenceSchema>;

export const ReferenceResolutionSchema = z.enum(['resolved', 'not_in_package', 'unclear']);
export type ReferenceResolution = z.infer<typeof ReferenceResolutionSchema>;

export const ExternalReferenceSchema = RawReferenceSchema.extend({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  resolution: ReferenceResolutionSchema,
  resolvedDocId: Hex64.optional(),
  /**
   * Additive (Source File): the cited part of the resolved document ("Section 3.2 of the
   * Partnership Agreement"), only when that exact label exists in it. Never guessed.
   */
  resolvedPart: PackagePartSchema.optional(),
  confirmedByAnalyst: z.boolean(),
}).strict();
export type ExternalReference = z.infer<typeof ExternalReferenceSchema>;

export const UsedTermSchema = z.strictObject({
  term: z.string().min(1).max(120),
  mentions: z.number().int().positive(),
  firstLocation: DocLocationSchema,
});
export type UsedTerm = z.infer<typeof UsedTermSchema>;

export const SuppressedTermSchema = z.strictObject({
  term: z.string().min(1).max(120),
  findingId: z.string(),
  definingDocId: Hex64,
  quote: z.string().max(240),
  definitionLocation: DefinitionLocationSchema.optional(),
});
export type SuppressedTerm = z.infer<typeof SuppressedTermSchema>;

export const PrimaryFactsSchema = z.strictObject({
  docId: Hex64,
  references: z.array(RawReferenceSchema),
  dropped: z.number().int().nonnegative(),
  usedTerms: z.array(UsedTermSchema).max(200),
  carveOutTarget: z.string().nullable(),
  localTerms: z.array(z.string()),
  scopeLabels: z.array(z.string()),
  suppressed: z.array(SuppressedTermSchema),
});
export type PrimaryFacts = z.infer<typeof PrimaryFactsSchema>;

export const CrossDocTermSchema = z.strictObject({
  term: z.string().min(1).max(120),
  status: z.enum(['defined_in_package', 'unverified']),
  mentions: z.number().int().nonnegative(),
  definingDocId: Hex64.optional(),
  quote: z.string().max(240).optional(),
  reason: z.enum(['no_reference_document', 'not_in_reference_documents']).optional(),
  /** Additive (Source File): where the defining document defines the term. */
  definitionLocation: DefinitionLocationSchema.optional(),
});
export type CrossDocTerm = z.infer<typeof CrossDocTermSchema>;

export const COVERAGE_GROUP_IDS = [
  'structure_flow',
  'internal_refs',
  'defined_terms',
  'external_refs',
  'investor_paths',
] as const;
export const CoverageGroupIdSchema = z.enum(COVERAGE_GROUP_IDS);
export type CoverageGroupId = z.infer<typeof CoverageGroupIdSchema>;
export const CoverageStatusSchema = z.enum(['full', 'partial', 'blocked']);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

export const CoverageGroupSchema = z.strictObject({
  id: CoverageGroupIdSchema,
  label: z.string(),
  status: CoverageStatusSchema,
  missingTypes: z.array(PackageDocTypeSchema),
  reasons: z.array(z.string()),
});
export type CoverageGroup = z.infer<typeof CoverageGroupSchema>;

export const DocumentRequestSchema = z.strictObject({
  id: z.string().regex(/^[0-9a-f]{16}$/),
  targetKey: z.string(),
  label: z.string(),
  targetFamily: TargetFamilySchema,
  quote: z.string().max(240),
  count: z.number().int().positive(),
  firstDocId: Hex64,
});
export type DocumentRequest = z.infer<typeof DocumentRequestSchema>;

export const PackageAnalysisSchema = z.strictObject({
  schema: z.literal('package-analysis.v1'),
  documents: z.array(PackageDocumentSchema),
  references: z.array(ExternalReferenceSchema),
  terms: z.array(CrossDocTermSchema),
  coverage: z.array(CoverageGroupSchema),
  requests: z.array(DocumentRequestSchema),
  dropped: z.number().int().nonnegative(),
});
export type PackageAnalysis = z.infer<typeof PackageAnalysisSchema>;

export const GATED_DOC_TYPES = ['sub_agreement', 'lpa', 'ppm', 'tax_form', 'side_letter'] as const;
export const GateLevelSchema = z.enum(['block', 'warn', 'off']);
export const PackagePolicySchema = z.strictObject({
  missingDocGate: z.record(z.enum(GATED_DOC_TYPES), GateLevelSchema),
  warnOnlyWhenReferenced: z.array(z.enum(GATED_DOC_TYPES)),
});
export type PackagePolicy = z.infer<typeof PackagePolicySchema>;

export const PackageGateReasonSchema = z.strictObject({
  level: z.enum(['block', 'warn']),
  docType: PackageDocTypeSchema,
  text: z.string(),
});
export type PackageGateReason = z.infer<typeof PackageGateReasonSchema>;

export const BaselineCandidateSchema = z.strictObject({
  docId: z.string().min(1),
  name: z.string(),
  firmId: z.string().nullable(),
  packageId: z.string().min(1),
  storedDocId: z.string().optional(),
  createdAt: z.string().optional(),
});
export type BaselineCandidate = z.infer<typeof BaselineCandidateSchema>;

export const PackageProblemSchema = z.strictObject({
  code: z.enum(['low_confidence_unconfirmed', 'no_to_digitize', 'multiple_to_digitize']),
  docId: z.string().optional(),
});
export type PackageProblem = z.infer<typeof PackageProblemSchema>;

/** Detection input: light facts only (never the full document). */
export interface DetectInput {
  name: string;
  titleLines: readonly string[];
  headText: string;
  headings?: readonly string[];
}

export interface DetectResult {
  type: PackageDocType;
  role: PackageDocRole;
  confidence: PackageConfidence;
  reason: string;
}

/** LLM seam only (T2): no task is registered; tests inject a fake. */
export type DocTypeSuggester = (
  input: DetectInput,
) => Promise<{ type: PackageDocType; confidence: PackageConfidence } | null>;
