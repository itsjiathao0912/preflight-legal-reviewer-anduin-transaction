/**
 * Issue class codes accepted by the persisted Class filter. Mirrors the DATA-MODEL issue_class list
 * (core ISSUE_CLASSES lives behind the worker boundary; class labels arrive with each finding).
 */
export const ISSUE_CLASSES_VIEW: readonly string[] = Object.freeze([
  'broken_cross_reference',
  'broken_conditional',
  'unreachable_or_circular_flow',
  'option_gap_overlap',
  'defined_term_issue',
  'inconsistent_footnote_requirement',
  'logic_contradiction',
  'ambiguity',
  'meaningful_typo',
  'version_drift',
  'drafting_note',
  'placeholder',
  'sensitive_data',
  'investor_path_dead_end',
  'investor_path_missing_item',
]);
