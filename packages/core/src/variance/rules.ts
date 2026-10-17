import { sha256Hex } from '../model/hash';
import type { IssueClass } from '../findings/taxonomy';
import rulesData from './variance-rules.json' with { type: 'json' };
import {
  REGEX_MAX_CHARS,
  VarianceRulesConfigSchema,
  type RoutingRule,
  type VarianceRulesConfig,
} from './rules-schema';
import type { Owner, RuleId } from './types';

/**
 * Load, validate and hash the versioned variance rules config (AC-V19). An invalid config throws
 * `VarianceConfigError` naming the failing path and never yields partial rules, so no finding can
 * be produced from a bad config. `rulesHash8` = first 8 hex of sha256 over canonical (sorted-key)
 * JSON, so the hash is stable under key reorder and recorded in every finding's provenance.
 */

export class VarianceConfigError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`variance rules config invalid at ${path || '(root)'}: ${message}`);
    this.name = 'VarianceConfigError';
    this.path = path;
  }
}

export interface CompiledRoutingRule extends Omit<RoutingRule, 'match'> {
  match: Omit<RoutingRule['match'], 'title'> & { title?: RegExp };
}

export interface CompiledAudienceDimension {
  id: string;
  label: string;
  patterns: RegExp[];
  complement?: string;
}

export interface VarianceRules {
  readonly config: VarianceRulesConfig;
  readonly version: string;
  readonly hash8: string;
  readonly routing: readonly CompiledRoutingRule[];
  readonly audience: readonly CompiledAudienceDimension[];
  readonly restrictions: readonly RegExp[];
  readonly ruleLabel: (id: RuleId) => string;
  readonly errorOwner: (issueClass: IssueClass | string) => Owner;
}

/** Canonical JSON: object keys sorted recursively; arrays keep their order. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
}

export function rulesHash8(config: unknown): string {
  return sha256Hex(canonicalJson(config)).slice(0, 8);
}

/**
 * Reject regex sources with a quantified group that itself contains a quantifier (`(a+)+`,
 * `(?:x*y)*`): catastrophic-backtracking shapes. Config patterns must be linear-time.
 */
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/;

function compile(source: string, path: string): RegExp {
  if (source.length > REGEX_MAX_CHARS) throw new VarianceConfigError(path, 'pattern too long');
  if (NESTED_QUANTIFIER.test(source))
    throw new VarianceConfigError(path, 'nested quantifier (not linear-time)');
  try {
    return new RegExp(source, 'iu');
  } catch {
    throw new VarianceConfigError(path, 'pattern does not compile');
  }
}

export function loadVarianceRules(raw: unknown = rulesData): VarianceRules {
  const parsed = VarianceRulesConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new VarianceConfigError(issue.path.map(String).join('.'), issue.message);
  }
  const config = parsed.data;
  const routing = config.routing.map((r, i) => {
    const { title, ...rest } = r.match;
    const match: CompiledRoutingRule['match'] = { ...rest };
    if (title !== undefined) match.title = compile(title, `routing.${i}.match.title`);
    return { ...r, match };
  });
  const audience = config.audience_dimensions.map((d, i) => ({
    id: d.id,
    label: d.label,
    patterns: d.patterns.map((p, j) => compile(p, `audience_dimensions.${i}.patterns.${j}`)),
    ...(d.complement ? { complement: d.complement } : {}),
  }));
  const restrictions = config.restriction_phrases.map((p, i) =>
    compile(p, `restriction_phrases.${i}`),
  );
  const labels = new Map(config.rules.map((r) => [r.id, r.label] as const));
  const errorOwners = config.error_owner_by_issue_class as Partial<Record<string, Owner>>;
  return Object.freeze({
    config,
    version: config.version,
    hash8: rulesHash8(config),
    routing: Object.freeze(routing),
    audience: Object.freeze(audience),
    restrictions: Object.freeze(restrictions),
    ruleLabel: (id: RuleId) => labels.get(id) ?? id,
    errorOwner: (issueClass: string) => errorOwners[issueClass] ?? config.default_owner,
  });
}

let shipped: VarianceRules | undefined;

/** The shipped config, loaded once. */
export function defaultVarianceRules(): VarianceRules {
  shipped ??= loadVarianceRules();
  return shipped;
}
