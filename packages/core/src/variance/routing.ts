import type { IssueClass } from '../findings/taxonomy';
import type { VarianceRules } from './rules';
import type { Owner, RuleId, ShownChangeType } from './types';

/**
 * Owner routing (DECISION D4): ordered first-match rules from the config. A rule matches when
 * EVERY condition it states holds (change type, unit-title regex, rule id, any keyword in the
 * changed text, audience restriction). It returns 1-2 owners and a one-line reason; no match
 * gives the default owner (counsel). Error findings take their owner from the `issue_class` row.
 */

export interface RouteInput {
  changeType: ShownChangeType;
  title: string;
  ruleId: RuleId;
  /** Changed text of the row (non-cosmetic hunks, old and new). */
  text: string;
  audienceRestricted: boolean;
}

export interface Route {
  owners: Owner[];
  reason: string;
  /** Routing rule id, or `default`. */
  routingId: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function keywordHit(text: string, keyword: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(keyword)}`, 'iu').test(text);
}

export function routeChange(input: RouteInput, rules: VarianceRules): Route {
  for (const r of rules.routing) {
    const m = r.match;
    if (m.change_type !== undefined && m.change_type !== input.changeType) continue;
    if (m.rule_id !== undefined && m.rule_id !== input.ruleId) continue;
    if (m.title !== undefined && !m.title.test(input.title)) continue;
    if (m.keywords !== undefined && !m.keywords.some((k) => keywordHit(input.text, k))) continue;
    if (m.audience_restricted !== undefined && m.audience_restricted !== input.audienceRestricted)
      continue;
    return { owners: [...r.owners], reason: r.reason, routingId: r.id };
  }
  return {
    owners: [rules.config.default_owner],
    reason: rules.config.default_reason,
    routingId: 'default',
  };
}

export function routeError(issueClass: IssueClass | string, rules: VarianceRules): Route {
  const owner = rules.errorOwner(issueClass);
  return {
    owners: [owner],
    reason: `Owner for ${issueClass} findings from the routing table`,
    routingId: `issue_class:${issueClass}`,
  };
}
