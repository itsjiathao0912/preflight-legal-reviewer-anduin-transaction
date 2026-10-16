import { z } from 'zod';

/** The 15 issue_class codes (DATA-MODEL 2.1 `issue_class`), with display labels and sort order. */
export const ISSUE_CLASSES = [
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
] as const;

export const IssueClassSchema = z.enum(ISSUE_CLASSES);
export type IssueClass = z.infer<typeof IssueClassSchema>;

export const ISSUE_CLASS_LABELS: Readonly<Record<IssueClass, string>> = Object.freeze({
  broken_cross_reference: 'Broken cross-reference',
  broken_conditional: 'Broken conditional',
  unreachable_or_circular_flow: 'Unreachable or circular flow',
  option_gap_overlap: 'Option gap or overlap',
  defined_term_issue: 'Defined term issue',
  inconsistent_footnote_requirement: 'Inconsistent footnote requirement',
  logic_contradiction: 'Logic contradiction',
  ambiguity: 'Ambiguity',
  meaningful_typo: 'Meaningful typo',
  version_drift: 'Version drift',
  drafting_note: 'Drafting note',
  placeholder: 'Placeholder',
  sensitive_data: 'Sensitive data',
  investor_path_dead_end: 'Investor path dead end',
  investor_path_missing_item: 'Investor path missing item',
});

export function issueClassSort(c: IssueClass): number {
  return ISSUE_CLASSES.indexOf(c) + 1;
}
