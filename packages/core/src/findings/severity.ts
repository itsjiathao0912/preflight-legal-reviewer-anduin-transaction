import { z } from 'zod';
import type { IssueClass } from './taxonomy';

/** critical = blocks digitization. */
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export function severityRank(s: Severity): number {
  return RANK[s];
}

/** Lower of two severities. */
export function capSeverity(s: Severity, cap: Severity): Severity {
  return RANK[s] > RANK[cap] ? cap : s;
}

/** Blocking = critical or high (gate + memory re-confirm rule). */
export function isBlocking(s: Severity): boolean {
  return s === 'critical' || s === 'high';
}

/** Hard caps: AI-only findings <= high; sensitive_data <= medium (last-4 collisions never hide a blocking item). */
export function maxSeverityFor(issueClass: IssueClass, detectorKind: 'rule' | 'ai'): Severity {
  if (issueClass === 'sensitive_data') return 'medium';
  if (detectorKind === 'ai') return 'high';
  return 'critical';
}
