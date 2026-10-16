import type { ActiveDecision, MemoryLabel } from '../contracts/memory';
import { isBlocking, type Severity } from '../findings/severity';
import type { IssueClass } from '../findings/taxonomy';

/**
 * resolveLabel (DATA-MODEL 2.3). Pure.
 * null -> new; status !== active (revoked/superseded) -> new; fingerprint mismatch -> new;
 * dismissed + blocking -> dismissed_reconfirm; dismissed + non-blocking -> previously_dismissed;
 * answered A/B/C -> already_answered; answered unclear -> new; accepted (no answer) -> awaiting_counsel.
 */
export function resolveLabel(
  finding: { severity: Severity; issue_class: IssueClass | string; fingerprint?: string | null },
  activeDecision: Pick<
    ActiveDecision,
    'fingerprint' | 'status' | 'decision' | 'counsel_option'
  > | null,
): MemoryLabel {
  if (activeDecision === null) return 'new';
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
