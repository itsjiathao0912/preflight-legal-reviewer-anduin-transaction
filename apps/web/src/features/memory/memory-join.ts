import type { ActiveDecision, AuditEvent, ReasonCode, Rule } from '@aduin/core';
import { reasonLabel } from '../review/reasons';

/**
 * Pure client-side joins for the firm memory page (Phase 08b). No contract change: everything is
 * derived from `GET /api/memory/firm`, `GET /api/rules` and the loaded `GET /api/audit` pages.
 *
 * - Reopened decisions (X6): the firm endpoint returns active decisions only, so reopened rows are
 *   rebuilt from `decision_revoked` audit events of the firm (lean rows).
 * - Matching dismissals: the firm's active dismissals with the proposal's (pattern_key,
 *   reason_code). This is NEVER the rule's `evidence_count` (linked evidence, at most 10).
 * - Rule who/when (X5) and audit groups come from audit events.
 */

export type AuditGroup = 'decision' | 'reopen' | 'rule';
export type AuditFilter = 'all' | AuditGroup;

/** Local literal action lists (type-only core imports in features/memory). */
const GROUP_OF: Readonly<Record<string, AuditGroup>> = Object.freeze({
  decision_recorded: 'decision',
  answer_recorded: 'decision',
  decision_revoked: 'reopen',
  rule_added: 'rule',
  rule_proposed: 'rule',
  rule_approved: 'rule',
  rule_rejected: 'rule',
  rule_revoked: 'rule',
});

const REASONS: readonly string[] = [
  'firm_standard_wording',
  'no_form_impact',
  'tool_false_alarm',
  'other',
];

function isReason(v: unknown): v is ReasonCode {
  return typeof v === 'string' && REASONS.includes(v);
}

/** Action group of an audit event; null for events outside the three groups. */
export function auditGroup(e: Pick<AuditEvent, 'action'>): AuditGroup | null {
  return GROUP_OF[e.action] ?? null;
}

/**
 * Events of the selected firm (events without a firm, such as `session_created`, are excluded),
 * narrowed to one action group. Order is kept (the API returns newest first).
 */
export function filterAudit(
  events: readonly AuditEvent[],
  group: AuditFilter,
  firmId: string,
): AuditEvent[] {
  return events.filter(
    (e) => e.law_firm_id === firmId && (group === 'all' || auditGroup(e) === group),
  );
}

export interface ReopenedRow {
  /** The revoked decision id (`entity_id` of the event). */
  id: string;
  who: string;
  at: number;
  reason: string | null;
  /** Kind of the revoked decision (`detail.decision`), when present. */
  decision: string | null;
  /** From the same-entity `decision_recorded` event when loaded; else null (shown as "—"). */
  issueClass: string | null;
}

/**
 * Reopened (revoked) decisions of the firm, rebuilt from `decision_revoked` events. A decision that
 * is still active (re-decided later) is not listed. One row per decision (the newest event).
 */
export function joinRevoked(
  decisions: readonly ActiveDecision[],
  events: readonly AuditEvent[],
  firmId?: string,
): ReopenedRow[] {
  const active = new Set(decisions.map((d) => d.id));
  const classOf = new Map<string, string>();
  for (const e of events) {
    if (e.action !== 'decision_recorded' || !e.entity_id) continue;
    const c = e.detail?.['issue_class'];
    if (typeof c === 'string' && !classOf.has(e.entity_id)) classOf.set(e.entity_id, c);
  }
  const seen = new Set<string>();
  const out: ReopenedRow[] = [];
  const sorted = [...events].sort((a, b) => b.at - a.at);
  for (const e of sorted) {
    if (e.action !== 'decision_revoked' || !e.entity_id) continue;
    if (firmId !== undefined && e.law_firm_id !== firmId) continue;
    if (active.has(e.entity_id) || seen.has(e.entity_id)) continue;
    seen.add(e.entity_id);
    const kind = e.detail?.['decision'];
    out.push({
      id: e.entity_id,
      who: e.actor_name,
      at: e.at,
      reason: e.reason ?? null,
      decision: typeof kind === 'string' ? kind : null,
      issueClass: classOf.get(e.entity_id) ?? null,
    });
  }
  return out;
}

export interface MatchingDismissals {
  /** 'text': pattern from the generated rule text + reason from the audit event; 'fallback': the
   *  single 3+ (pattern_key, reason_code) group; 'none': unresolved (no list shown). */
  via: 'text' | 'fallback' | 'none';
  patternKey: string | null;
  reasonCode: ReasonCode | null;
  decisions: ActiveDecision[];
}

const GENERATED = /^Findings matching "([^"]{1,80})" are usually /;
const PROPOSAL_MIN = 3;

function isDismissal(d: ActiveDecision): boolean {
  return d.decision === 'dismissed' && d.status === 'active';
}

/**
 * Active dismissals of the firm that match a proposed rule's (pattern_key, reason_code).
 * (1) pattern from the generated text plus `detail.reason_code` of the rule's `rule_proposed`
 * event; (2) fallback (seeded free-text rule): the single (pattern_key, reason_code) group with 3+
 * members and a reason other than `other`; (3) otherwise none. Never derived from `evidence_count`.
 */
export function matchingDismissals(
  rule: Pick<Rule, 'id' | 'text'>,
  decisions: readonly ActiveDecision[],
  events: readonly AuditEvent[],
): MatchingDismissals {
  const textKey = GENERATED.exec(rule.text)?.[1] ?? null;
  const proposed = events.find((e) => e.action === 'rule_proposed' && e.entity_id === rule.id);
  const auditReason = proposed?.detail?.['reason_code'];
  const dismissals = decisions.filter(isDismissal);
  if (textKey && isReason(auditReason)) {
    return {
      via: 'text',
      patternKey: textKey,
      reasonCode: auditReason,
      decisions: dismissals.filter(
        (d) => d.pattern_key === textKey && d.reason_code === auditReason,
      ),
    };
  }
  const groups = new Map<string, ActiveDecision[]>();
  for (const d of dismissals) {
    if (!d.pattern_key || !d.reason_code || d.reason_code === 'other') continue;
    if (textKey && d.pattern_key !== textKey) continue;
    const k = `${d.pattern_key}|${d.reason_code}`;
    const g = groups.get(k);
    if (g) g.push(d);
    else groups.set(k, [d]);
  }
  const big = [...groups.values()].filter((g) => g.length >= PROPOSAL_MIN);
  if (big.length === 1) {
    const g = big[0]!;
    return {
      via: 'fallback',
      patternKey: g[0]!.pattern_key ?? null,
      reasonCode: g[0]!.reason_code ?? null,
      decisions: g,
    };
  }
  return { via: 'none', patternKey: textKey, reasonCode: null, decisions: [] };
}

export interface WhoWhen {
  who: string;
  at: number;
  action: string;
}

/** Who made the rule what it is now: approved, else added, else proposed (newest of that kind). */
export function ruleWhoWhen(rule: Pick<Rule, 'id'>, events: readonly AuditEvent[]): WhoWhen | null {
  for (const action of ['rule_approved', 'rule_added', 'rule_proposed']) {
    const hit = events
      .filter((e) => e.action === action && e.entity_id === rule.id)
      .sort((a, b) => b.at - a.at)[0];
    if (hit) return { who: hit.actor_name, at: hit.at, action };
  }
  return null;
}

/** Short display id for an entity (X11: no join to loaded rows). */
export function shortId(id: string | undefined): string {
  if (!id) return '';
  return id.length > 8 ? `…${id.slice(-6)}` : id;
}

/**
 * Display form of an event for the unmodified Phase 08 `AuditList` (X11): Target = entity type +
 * short id; Why = the event reason, else the `reason_code` label from `detail`.
 */
export function auditForDisplay(e: AuditEvent): AuditEvent {
  const target = e.entity_type ? `${e.entity_type} ${shortId(e.entity_id)}`.trim() : undefined;
  const code = e.detail?.['reason_code'];
  const why = e.reason ?? (isReason(code) ? reasonLabel(code) : undefined);
  const { entity_type: _t, reason: _r, ...rest } = e;
  return {
    ...rest,
    ...(target ? { entity_type: target.slice(0, 40) } : {}),
    ...(why ? { reason: why } : {}),
  };
}

/** Readable issue class when no label from the open document is known. */
export function humanClass(code: string | null | undefined): string {
  if (!code) return '—';
  const s = code.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
