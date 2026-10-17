export { runVariance, numberMapOf } from './run';
export { varianceMetaOf, encodeList, VARIANCE_DETECTOR_PREFIX } from './adapter';
export {
  loadVarianceRules,
  defaultVarianceRules,
  rulesHash8,
  canonicalJson,
  VarianceConfigError,
  type VarianceRules,
} from './rules';
export { VarianceRulesConfigSchema, type VarianceRulesConfig } from './rules-schema';
export { questionKey, parseQuestionKey, isOwner } from './owners';
export {
  runRegressionChecks,
  describeAssertion,
  assertionCandidateOf,
  scopeExists,
  type AssertionSource,
} from './regression';
export { normalizeAssertionLabel, displayAssertionLabel } from './label';
export { routeChange, routeError, type Route, type RouteInput } from './routing';
export { computeImpact, IMPACT_PROVENANCE } from './impact';
export { diffAudience } from './audience';
export {
  OWNERS,
  CHANGE_CLASSES,
  RULE_IDS,
  type Owner,
  type ChangeClass,
  type ShownChangeType,
  type RuleId,
  type VarianceSide,
  type VarianceInput,
  type Hunk,
  type ClassifiedHunk,
  type CosmeticGroup,
  type ImpactResult,
  type AudienceResult,
  type AssertionCandidate,
  type RegressionCheck,
  type VarianceMeta,
  type VarianceSummary,
  type VarianceResult,
} from './types';
