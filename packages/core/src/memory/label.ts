import type { ActiveDecision, MemoryLabel } from '../contracts/memory';
import { isBlocking, type Severity } from '../findings/severity';
import type { IssueClass } from '../findings/taxonomy';

/**
 * resolveLabel (DATA-MODEL 2.3). Pure.
 * null -> new; status !== active (revoked/superseded) -> new; fingerprint mismatch -> new;
 * dismissed + blocking -> dismissed_reconfirm; dismissed + non-blocking -> previously_dismissed;
 * answered A/B/C -> already_answered; answered unclear -> new; accepted (no answer) -> awaiting_counsel.
 * Variance scope rule (D5): a decision with scope `fund` applies only when `ctx.fundName` equals its
 * `fund_name`; otherwise it behaves as if no active decision matched. Scope absent or `ctx` absent
 * behaves exactly as before.
 */
export function resolveLabel(
  finding: { severity: Severity; issue_class: IssueClass | string; fingerprint?: string | null },
  activeDecision:
    | (Pick<ActiveDecision, 'fingerprint' | 'status' | 'decision' | 'counsel_option'> &
        Partial<Pick<ActiveDecision, 'scope' | 'fund_name'>>)
    | null,
  ctx?: { fundName?: string },
): MemoryLabel {
  if (activeDecision === null) return 'new';
  if (scopeMismatch(activeDecision, ctx)) return 'new';
  if (activeDecision.status !== 'active') return 'new';
  if (!finding.fingerprint || finding.fingerprint !== activeDecision.fingerprint) return 'new';
  switch (activeDecision.decision) {
    case 'dismissed':
      return isBlocking(finding.severity) ? 'dismissed_reconfirm' : 'previously_dismissed';
    case 'answered':
      return activeDecision.counsel_option && activeDecision.counsel_option !== 'unclear'
        ? 'already_answered'
        : 'new';
    case 'accepted':
      return 'awaiting_counsel';
    default: {
      const never: never = activeDecision.decision;
      return never;
    }
  }
}

/**
 * True when a fund-scoped decision is evaluated for a different fund (the decision must not apply).
 * Only `scope === 'fund'` with a `ctx` can mismatch; firm_template and legacy rows always apply.
 */
export function scopeMismatch(
  decision: Partial<Pick<ActiveDecision, 'scope' | 'fund_name'>>,
  ctx?: { fundName?: string },
): boolean {
  if (ctx === undefined || decision.scope !== 'fund') return false;
  return ctx.fundName !== decision.fund_name;
}
