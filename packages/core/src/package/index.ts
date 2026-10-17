// Fund package intake module (Phase 1). Pure and deterministic.
export * from './types';
export { PACKAGE_LIMITS, checkPackageLimits, type PackageLimitResult } from './config';
export {
  DEFAULT_PACKAGE_POLICY,
  COVERAGE_GROUP_DEFS,
  DOC_TYPE_LABELS,
  packageGateReasons,
  type CoverageGroupDef,
} from './policy';
export {
  DETECT_RULES,
  detectDocument,
  resolveRoles,
  mergeSuggestion,
  normalizeFileName,
  NO_MATCH_REASON,
  TWO_SUBS_REASON,
  type DetectRule,
} from './detect';
export {
  buildPackageFacts,
  extractPrimaryFacts,
  scopeLabelsOf,
  type PackageFactsInput,
} from './facts';
export { extractPackageDefinitions } from './definitions';
export {
  extractExternalReferences,
  NAMED_DOCUMENTS,
  DEFINITIONAL_PHRASES,
  GOVERNING_PHRASES,
  type ReferenceContext,
} from './references';
export {
  applyPackageDefinitions,
  definitionSources,
  buildCrossDocTerms,
  extractUsedTerms,
} from './terms';
export { DOC_SYNONYMS, resolveReferences, CONFIRMED_NONE } from './resolve';
export { computeCoverage, coverageLineText } from './coverage';
export { buildDocumentRequests } from './request';
export { eligibleBaselines } from './baseline';
export { analyzePackage, packageRunReadiness, type AnalyzePackageInput } from './analyze';
