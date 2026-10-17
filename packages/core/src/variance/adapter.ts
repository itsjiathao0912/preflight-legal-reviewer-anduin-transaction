import { z } from 'zod';
import { limits } from '../config/limits';
import { templateVersionDriftInterpretations } from '../counsel/template-draft';
import { findingId } from '../findings/ids';
import { FindingSchema, type Finding } from '../findings/schema';
import { quoteHash } from '../memory/fingerprint';
import { mask, sensitiveSpans } from '../memory/mask';
import { makeAnchor } from '../model/anchors';
import type { Structure } from '../structure/types';
import type { VarianceRules } from './rules';
import {
  OWNERS,
  RULE_IDS,
  type AssertionCandidate,
  type AudienceResult,
  type ImpactResult,
  type Owner,
  type RuleId,
  type VarianceMeta,
} from './types';

/**
 * Finding adapter (DECISION D2). Change rows and regression results become frozen-v1 `Finding`s
 * built WITHOUT `buildFinding` (its quote comes from the new graph block, wrong for a removed
 * unit): composed with `findingId`, `quoteHash`, `makeAnchor`, `mask`/`sensitiveSpans` and
 * `FindingSchema.parse`. Every `detail.facts` value is a scalar (string <= 1000 chars, number,
 * boolean, null); lists are one deterministic JSON string each; the assertion candidate is two
 * flat keys. `varianceMetaOf` is the ONLY decoder.
 */

export const VARIANCE_DETECTOR_PREFIX = 'variance.';
export const FACT_MAX = 1000;
const TRUNCATED = '__truncated__';

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + '…');

/** JSON-encode a list, dropping tail items (with a marker) so the string stays <= 1000 chars. */
export function encodeList(items: readonly unknown[]): string {
  const all = JSON.stringify(items);
  if (all.length <= FACT_MAX) return all;
  const kept: unknown[] = [];
  for (const it of items) {
    if (JSON.stringify([...kept, it, TRUNCATED]).length > FACT_MAX) break;
    kept.push(it);
  }
  return JSON.stringify([...kept, TRUNCATED]);
}

function decodeList(s: string): unknown[] {
  const v: unknown = JSON.parse(s);
  if (!Array.isArray(v)) throw new Error('variance facts: list expected');
  return v.filter((x) => x !== TRUNCATED);
}

export interface ChangeFindingInput {
  docHash: string;
  /** New-document structure (anchor, section path, page); old structure for a removed unit. */
  anchorStructure: Structure;
  /** Block index in `anchorStructure`; -1 = doc start (removed unit). */
  blockIndex: number;
  offsetStart: number;
  offsetEnd: number;
  quote: string;
  quoteSide: 'old' | 'new';
  changeType: 'new' | 'changed_logic';
  ruleId: RuleId;
  title: string;
  owners: Owner[];
  ownerReason: string;
  oldText: string;
  newText: string;
  unitKeyA: string | null;
  unitKeyB: string | null;
  hunkCount: number;
  impact: ImpactResult | null;
  assertion?: AssertionCandidate;
  baselineDoc: string;
}

function sectionPathOf(s: Structure, bi: number): string[] {
  return bi >= 0
    ? [...(s.blocks[bi]?.section_path ?? [])].slice(0, 8).map((p) => clip(p, 300))
    : [];
}

function compose(args: {
  docHash: string;
  structure: Structure;
  blockIndex: number;
  offsetStart: number;
  offsetEnd: number;
  quote: string;
  detectorId: string;
  patternKey: string;
  severity: 'medium' | 'critical';
  explanation: string;
  facts: Record<string, string | number | boolean | null>;
  interpretations: string[];
}): Finding {
  const raw = args.quote.replace(/\s+/g, ' ').trim() || '(empty)';
  const masked = clip(mask(raw, sensitiveSpans(raw)), limits.quoteMaxChars);
  const qh = quoteHash(masked);
  const block = args.blockIndex >= 0 ? args.structure.blocks[args.blockIndex] : undefined;
  const blockId = block?.id ?? 'b0';
  const start = block ? Math.max(0, args.offsetStart) : 0;
  const end = block ? Math.max(start, args.offsetEnd) : 0;
  const anchor = makeAnchor(args.docHash, blockId, start, end);
  const f: Finding = {
    id: findingId(args.detectorId, 'version_drift', anchor, qh),
    issue_class: 'version_drift',
    severity: args.severity,
    detector_kind: 'rule',
    detector_id: args.detectorId,
    confidence: 1,
    anchor,
    section_path: sectionPathOf(args.structure, args.blockIndex),
    quote: masked,
    quote_snippet: clip(masked, limits.snippetMaxChars),
    quote_hash: qh,
    pattern_key: args.patternKey,
    detail: {
      explanation: clip(args.explanation, 1000),
      facts: Object.fromEntries(
        Object.entries(args.facts).map(([k, v]) => [
          k,
          typeof v === 'string' ? clip(v, FACT_MAX) : v,
        ]),
      ),
      interpretations: args.interpretations,
    },
  };
  const page = block?.lines[0]?.page;
  if (page) f.page = page;
  return FindingSchema.parse(f);
}

function impactFacts(impact: ImpactResult | null): Record<string, string | boolean | null> {
  if (!impact)
    return {
      impact_investor_types: null,
      impact_conditionals: null,
      impact_reusable: null,
      impact_uncertain: null,
      impact_audience: null,
      impact_line: null,
    };
  return {
    impact_investor_types: encodeList(impact.investorTypes),
    impact_conditionals: encodeList(impact.conditionals),
    impact_reusable: impact.reusable,
    impact_uncertain: impact.uncertain,
    impact_audience: impact.audience ? clip(JSON.stringify(impact.audience), FACT_MAX) : null,
    impact_line: clip(impact.line, FACT_MAX),
  };
}

export function buildChangeFinding(input: ChangeFindingInput, rules: VarianceRules): Finding {
  const facts: Record<string, string | number | boolean | null> = {
    kind: 'change',
    change_type: input.changeType,
    rule_id: input.ruleId,
    variance_rules_version: rules.version,
    variance_rules_hash8: rules.hash8,
    baseline_doc: input.baselineDoc,
    quote_side: input.quoteSide,
    title: input.title,
    suggested_owners: input.owners.join(','),
    owner_reason: input.ownerReason,
    old_text: input.oldText,
    new_text: input.newText,
    unit_key_a: input.unitKeyA,
    unit_key_b: input.unitKeyB,
    hunk_count: input.hunkCount,
    ...impactFacts(input.impact),
  };
  if (input.assertion) {
    facts.assertion_kind = input.assertion.kind;
    facts.assertion_label = input.assertion.label;
  }
  const label = rules.ruleLabel(input.ruleId);
  return compose({
    docHash: input.docHash,
    structure: input.anchorStructure,
    blockIndex: input.blockIndex,
    offsetStart: input.offsetStart,
    offsetEnd: input.offsetEnd,
    quote: input.quote,
    detectorId: `${VARIANCE_DETECTOR_PREFIX}${input.ruleId}`,
    patternKey: input.ruleId,
    severity: 'medium',
    explanation: `${input.title}. Rule ${input.ruleId} (${label}) classifies this change as ${input.changeType === 'new' ? 'new' : 'changed logic'} compared with ${input.baselineDoc}; suggested owner: ${input.owners.join(' and ')}.`,
    facts,
    interpretations: templateVersionDriftInterpretations({
      change_type: input.changeType,
      old_text: input.oldText,
      new_text: input.newText,
    }),
  });
}

export interface RegressionFindingInput {
  structure: Structure;
  statement: string;
  label: string;
  sourceFundName: string;
}

export function buildRegressionFinding(
  input: RegressionFindingInput,
  rules: VarianceRules,
): Finding {
  const title = `Regression: confirmed in ${input.sourceFundName}`;
  const facts: Record<string, string | number | boolean | null> = {
    kind: 'regression',
    change_type: 'regression',
    rule_id: 'VAR-REG-SCOPE-EXISTS',
    variance_rules_version: rules.version,
    variance_rules_hash8: rules.hash8,
    baseline_doc: input.sourceFundName,
    quote_side: 'old',
    title,
    suggested_owners: rules.config.default_owner,
    owner_reason: 'Firm-template answer re-checked on this document',
    old_text: input.statement,
    new_text: '',
    unit_key_a: null,
    unit_key_b: null,
    hunk_count: 0,
    ...impactFacts(null),
    assertion_kind: 'scope_exists',
    assertion_label: input.label,
  };
  return compose({
    docHash: input.structure.docHash,
    structure: input.structure,
    blockIndex: -1,
    offsetStart: 0,
    offsetEnd: 0,
    quote: input.statement,
    detectorId: `${VARIANCE_DETECTOR_PREFIX}regression.scope_exists`,
    patternKey: 'VAR-REG-SCOPE-EXISTS',
    severity: 'critical',
    explanation: `${title}. The firm-template check "${input.statement}" does not hold in this document (rule VAR-REG-SCOPE-EXISTS).`,
    facts,
    interpretations: templateVersionDriftInterpretations({
      change_type: 'changed_logic',
      old_text: input.statement,
      new_text: '',
    }),
  });
}

const OwnerList = z
  .string()
  .max(FACT_MAX)
  .transform((s, ctx) => {
    const parts = s.split(',').filter(Boolean);
    if (!parts.length || parts.some((p) => !(OWNERS as readonly string[]).includes(p))) {
      ctx.addIssue({ code: 'custom', message: 'bad suggested_owners' });
      return z.NEVER;
    }
    return parts as Owner[];
  });

const VarianceFactsSchema = z.object({
  kind: z.enum(['change', 'regression']),
  change_type: z.enum(['new', 'changed_logic', 'regression']),
  rule_id: z.enum(RULE_IDS),
  variance_rules_version: z.string().min(1),
  variance_rules_hash8: z.string().regex(/^[0-9a-f]{8}$/),
  baseline_doc: z.string(),
  quote_side: z.enum(['old', 'new']),
  title: z.string(),
  suggested_owners: OwnerList,
  owner_reason: z.string(),
  old_text: z.string(),
  new_text: z.string(),
  unit_key_a: z.string().nullable(),
  unit_key_b: z.string().nullable(),
  hunk_count: z.number().int().nonnegative(),
  impact_investor_types: z.string().nullable(),
  impact_conditionals: z.string().nullable(),
  impact_reusable: z.enum(['yes', 'no']).nullable(),
  impact_uncertain: z.boolean().nullable(),
  impact_audience: z.string().nullable(),
  impact_line: z.string().nullable(),
  assertion_kind: z.literal('scope_exists').optional(),
  assertion_label: z.string().min(1).max(80).optional(),
});

/**
 * The single typed decoder of variance facts. Undefined for a non-variance finding; throws on
 * malformed variance facts (never a partial shape).
 */
export function varianceMetaOf(
  f: Pick<Finding, 'detector_id' | 'issue_class' | 'detail'>,
): VarianceMeta | undefined {
  if (f.issue_class !== 'version_drift' || !f.detector_id.startsWith(VARIANCE_DETECTOR_PREFIX))
    return undefined;
  const p = VarianceFactsSchema.parse(f.detail.facts);
  const impact =
    p.impact_reusable === null
      ? null
      : {
          investor_types: decodeList(p.impact_investor_types ?? '[]').map(String),
          conditionals: decodeList(p.impact_conditionals ?? '[]') as Array<{
            old: string | null;
            new: string | null;
          }>,
          reusable: p.impact_reusable,
          uncertain: p.impact_uncertain ?? false,
          audience: p.impact_audience ? (JSON.parse(p.impact_audience) as AudienceResult) : null,
          line: p.impact_line ?? '',
        };
  if ((p.assertion_kind === undefined) !== (p.assertion_label === undefined))
    throw new Error('variance facts: assertion_kind and assertion_label go together');
  const meta: VarianceMeta = {
    kind: p.kind,
    change_type: p.change_type,
    rule_id: p.rule_id,
    variance_rules_version: p.variance_rules_version,
    variance_rules_hash8: p.variance_rules_hash8,
    baseline_doc: p.baseline_doc,
    quote_side: p.quote_side,
    title: p.title,
    owners: p.suggested_owners,
    owner_reason: p.owner_reason,
    old_text: p.old_text,
    new_text: p.new_text,
    unit_key_a: p.unit_key_a,
    unit_key_b: p.unit_key_b,
    hunk_count: p.hunk_count,
    impact,
  };
  if (p.assertion_kind && p.assertion_label)
    meta.assertion_candidate = { kind: p.assertion_kind, label: p.assertion_label };
  return meta;
}
