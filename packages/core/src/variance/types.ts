import type { Finding } from '../findings/schema';
import type { DocGraph } from '../graph/graph';
import type { Structure } from '../structure/types';
import type { InvestorTypeId } from '../investor/types';
import type { VarianceRules } from './rules';

/**
 * Variance types (Variance MVP Phase 01). Plain JSON, deterministic, no timing. Change rows are
 * frozen-v1 `Finding`s (`issue_class: 'version_drift'`); their metadata rides in `detail.facts`
 * as scalars only and is decoded by `varianceMetaOf` (the single decoder).
 */

export const OWNERS = ['counsel', 'gp', 'fund_admin'] as const;
export type Owner = (typeof OWNERS)[number];

export const CHANGE_CLASSES = ['new', 'changed_logic', 'changed_cosmetic'] as const;
export type ChangeClass = (typeof CHANGE_CLASSES)[number];

/** Classes a shown change row can carry (cosmetic hunks never become rows). */
export type ShownChangeType = Exclude<ChangeClass, 'changed_cosmetic'>;

/** Every rule id the classifier can emit (the config declares each one exactly once). */
export const RULE_IDS = [
  'VAR-NEW-UNIT',
  'VAR-NEW-INSERTION',
  'VAR-LOGIC-REMOVED',
  'VAR-LOGIC-GUARD-DIGIT',
  'VAR-LOGIC-GUARD-AMOUNT',
  'VAR-LOGIC-GUARD-NEGATION',
  'VAR-LOGIC-GUARD-MODAL',
  'VAR-LOGIC-GUARD-CONDITION',
  'VAR-LOGIC-GUARD-INVESTOR',
  'VAR-LOGIC-GUARD-JURISDICTION',
  'VAR-LOGIC-GUARD-TRUNCATED',
  'VAR-LOGIC-DEFAULT',
  'VAR-COS-RENUMBER',
  'VAR-COS-DATE',
  'VAR-COS-NAME',
  'VAR-COS-RENAME',
  'VAR-COS-FORMAT',
  'VAR-COS-MOVED',
  'VAR-COS-PAGE-LABEL',
  'VAR-REG-SCOPE-EXISTS',
] as const;
export type RuleId = (typeof RULE_IDS)[number];

/** One prepared side for variance: parsed document, graph, deterministic findings, firm. */
export interface VarianceSide {
  structure: Structure;
  graph: DocGraph;
  findings: readonly Finding[];
  /** Law firm id; both sides must carry the same non-null firm (D1 step 0). */
  firmId: string | null;
  /** Display label of the document (for example "Fund II"); defaults to a hash prefix. */
  label?: string;
}

export interface VarianceInput {
  baseline: VarianceSide;
  current: VarianceSide;
  /** Loaded rules (default: the shipped `variance-rules.json`). */
  rules?: VarianceRules;
}

/** One raw change (DECISION D1): a maximal run of non-same word tokens in an aligned unit pair. */
export interface Hunk {
  /** Stable index in raw order (new-document order). */
  index: number;
  unitKeyA?: string;
  unitKeyB?: string;
  kind: 'insert' | 'delete' | 'replace' | 'move';
  /** Whole added / removed unit: one hunk per block. */
  whole?: 'added' | 'removed';
  /** Changed tokens only (merged same tokens excluded), non-whitespace. */
  oldTokens: string[];
  newTokens: string[];
  /** Full hunk text (including merged same tokens), whitespace collapsed. */
  oldText: string;
  newText: string;
  /** Character span of the hunk in the old / new unit text. */
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  /** The text diff hit the edit bound: one coarse replace (guard word). */
  truncated: boolean;
}

export interface ClassifiedHunk extends Hunk {
  class: ChangeClass;
  ruleId: RuleId;
  /** Group key for cosmetic hunks (rule id, plus the rename / name pair). */
  groupKey?: string;
}

export interface CosmeticGroup {
  ruleId: RuleId;
  /** Group key: rule id, plus `:old -> new` for rename and name swaps. */
  key: string;
  label: string;
  count: number;
  /** Up to 3 examples in raw order. */
  examples: Array<{ old: string; new: string }>;
}

export interface ImpactResult {
  investorTypes: InvestorTypeId[];
  /** Affected conditional paths as old -> new trigger/action pairs. */
  conditionals: Array<{ old: string | null; new: string | null }>;
  reusable: 'yes' | 'no';
  uncertain: boolean;
  audience: AudienceResult | null;
  /** One-line plain summary, labelled deterministic. */
  line: string;
}

export interface AudienceResult {
  restricted: boolean;
  /** Audience dimension ids kept by the new text. */
  kept: string[];
  /** Audience dimension ids that lose the clause. */
  excluded: string[];
  /** Entity families named by the clause (person | entity | retirement). */
  families: string[];
  line: string | null;
}

export interface AssertionCandidate {
  kind: 'scope_exists';
  /** Normalized label (`normalizeAssertionLabel`), for example "appendix c". */
  label: string;
}

/** A stored regression check (only `scope_exists` in the MVP). */
export interface RegressionCheck {
  kind: 'scope_exists';
  label: string;
  /** Statement shown as the finding quote ("Appendix C must exist"). */
  statement: string;
  /** Fund where the firm-template answer was recorded ("Fund II"). */
  sourceFundName: string;
}

/** Decoded variance metadata (from `detail.facts`, via `varianceMetaOf`). */
export interface VarianceMeta {
  kind: 'change' | 'regression';
  change_type: ShownChangeType | 'regression';
  rule_id: RuleId;
  variance_rules_version: string;
  variance_rules_hash8: string;
  baseline_doc: string;
  quote_side: 'old' | 'new';
  title: string;
  owners: Owner[];
  owner_reason: string;
  old_text: string;
  new_text: string;
  unit_key_a: string | null;
  unit_key_b: string | null;
  hunk_count: number;
  impact: {
    investor_types: string[];
    conditionals: Array<{ old: string | null; new: string | null }>;
    reusable: 'yes' | 'no';
    uncertain: boolean;
    audience: AudienceResult | null;
    line: string;
  } | null;
  assertion_candidate?: AssertionCandidate;
}

export interface VarianceSummary {
  /** Total raw changes (hunks). */
  raw: number;
  /** Change rows shown (new + changed_logic). */
  shown: number;
  /** Cosmetic hunks (grouped, never findings). */
  cosmetic: number;
  new: number;
  changed_logic: number;
}

export interface VarianceResult {
  findings: Finding[];
  /** Decoded meta keyed by finding id. */
  meta: Record<string, VarianceMeta>;
  cosmeticGroups: CosmeticGroup[];
  summary: VarianceSummary;
  /** Every raw change with its class and rule id (audit; AC-V2). */
  rawChanges: ClassifiedHunk[];
  notice?: 'cross_firm';
}
