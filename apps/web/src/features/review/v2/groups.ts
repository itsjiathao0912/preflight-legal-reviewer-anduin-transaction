import type { Row } from '../model';
import type { GroupKey } from './types';

/** Blocking = severity-based ("Blocks digitization"). */
export const isBlocking = (r: Row): boolean => r.sev === 'block';

/**
 * Rows whose acceptance the gate still treats as open or unanswered: blocking severity, or a
 * change (variance) row. This is a static approximation of the shipped gate policy
 * (`untriaged_change_blocks: true`, `regression_blocks: true` in
 * packages/core/src/variance/variance-rules.json); the live policy is deliberately not read here.
 */
export const gatesReview = (r: Row): boolean => r.sev === 'block' || r.f.kind === 'change';

export function groupOf(r: Row): GroupKey {
  switch (r.status) {
    case 'open':
      return 'review';
    case 'counsel':
      return 'sent';
    case 'accepted':
      return gatesReview(r) ? 'sent' : 'closed';
    default:
      return 'closed';
  }
}

export interface Grouped {
  review: Row[];
  sent: Row[];
  closed: Row[];
}

/** Stable: keeps the incoming order inside each group. */
export function groupRows(visible: readonly Row[]): Grouped {
  const g: Grouped = { review: [], sent: [], closed: [] };
  for (const r of visible) g[groupOf(r)].push(r);
  return g;
}

export function flatOrder(g: Grouped): Row[] {
  return [...g.review, ...g.sent, ...g.closed];
}

export interface Progress {
  total: number;
  reviewed: number;
  sent: number;
  closed: number;
  left: number;
  done: boolean;
}

/** P-1: counts `view.main` rows, all severities and kinds, independent of filters. */
export function progressOf(main: readonly Row[]): Progress {
  const g = groupRows(main);
  const sent = g.sent.length;
  const closed = g.closed.length;
  const left = g.review.length;
  const total = sent + closed + left;
  return { total, reviewed: sent + closed, sent, closed, left, done: total > 0 && left === 0 };
}
