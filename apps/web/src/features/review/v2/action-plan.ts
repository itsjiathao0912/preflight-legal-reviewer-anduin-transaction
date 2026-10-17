import type { Row } from '../model';
import type { OwnerAsk } from '../../../state/review';
import { groupOf, isBlocking } from './groups';
import type { Control } from './types';

export type Plan =
  | { kind: 'call'; call: 'accept' | 'needsCounsel' | 'restore'; id: string; ask?: OwnerAsk }
  | { kind: 'open-close-modal'; id: string }
  | {
      kind: 'noop';
      reason: 'no-selection' | 'already-acted' | 'not-acted' | 'owner-required' | 'answered';
    };

const isChange = (r: Row): boolean => r.f.kind === 'change';

/** A recorded counsel or owner answer: restore() would drop it locally while memory keeps it. */
export function hasRecordedAnswer(r: Row): boolean {
  const t = r.triage;
  if (!t) return false;
  if (t.counselAnswer !== undefined && t.counselAnswer !== null) return true;
  return Object.values(t.ownerAnswers ?? {}).some((v) => v !== null && v !== undefined);
}

/** Maps a bar control to a store call. Never emits accept/needsCounsel for a non-open row. */
export function planControl(control: Control, row: Row | null, ctx?: { ask?: OwnerAsk }): Plan {
  if (!row) return { kind: 'noop', reason: 'no-selection' };
  const id = row.f.id;
  switch (control) {
    case 'ask-counsel': {
      if (row.status !== 'open') return { kind: 'noop', reason: 'already-acted' };
      if (isChange(row)) {
        const ask = ctx?.ask;
        if (!ask || ask.owners.length === 0) return { kind: 'noop', reason: 'owner-required' };
        return { kind: 'call', call: 'needsCounsel', id, ask };
      }
      return isBlocking(row)
        ? { kind: 'call', call: 'accept', id }
        : { kind: 'call', call: 'needsCounsel', id };
    }
    case 'close-issue':
      if (row.status !== 'open') return { kind: 'noop', reason: 'already-acted' };
      return { kind: 'open-close-modal', id };
    case 'move-back':
      if (row.status === 'open') return { kind: 'noop', reason: 'not-acted' };
      if (hasRecordedAnswer(row)) return { kind: 'noop', reason: 'answered' };
      return { kind: 'call', call: 'restore', id };
  }
}

export interface BarState {
  primary: 'ask-counsel' | 'move-back' | null;
  closeEnabled: boolean;
  moveBackEnabled: boolean;
  labels: { ask: string; close: string };
}

/** P-5: change rows read "Ask owner" / "Mark as expected..."; rule rows "Ask counsel" / "Close issue". */
export function barState(row: Row | null): BarState {
  const change = row !== null && isChange(row);
  const labels = change
    ? { ask: 'Ask owner', close: 'Mark as expected...' }
    : { ask: 'Ask counsel', close: 'Close issue' };
  if (!row) return { primary: null, closeEnabled: false, moveBackEnabled: false, labels };
  const open = row.status === 'open';
  return {
    primary: open ? 'ask-counsel' : 'move-back',
    closeEnabled: open,
    moveBackEnabled: !open && !hasRecordedAnswer(row),
    labels,
  };
}

/**
 * `flat` = flatOrder(groupRows(visible)) BEFORE the action. First To-review row after `actedId`,
 * else the first To-review row before it, else null.
 */
export function nextToReview(flat: readonly Row[], actedId: string): string | null {
  const idx = flat.findIndex((r) => r.f.id === actedId);
  const isNext = (r: Row): boolean => r.f.id !== actedId && groupOf(r) === 'review';
  if (idx >= 0) {
    for (let i = idx + 1; i < flat.length; i++) if (isNext(flat[i]!)) return flat[i]!.f.id;
    for (let i = 0; i < idx; i++) if (isNext(flat[i]!)) return flat[i]!.f.id;
    return null;
  }
  return flat.find(isNext)?.f.id ?? null;
}
