import type { ReasonCode } from '@aduin/core';
import type { Row } from '../model';
import { DISMISS_REASON_REQUIRED } from '../reasons';
import { gatesReview } from './groups';
import type { CloseReasonKey } from './types';

export interface CloseReasonOption {
  key: CloseReasonKey;
  label: string;
  blockingHidden: boolean;
  noteRequired: boolean;
}

/** D2 labels (design-owned; `reasons.ts` DISMISS_REASONS stays untouched). */
export const CLOSE_REASONS: readonly CloseReasonOption[] = Object.freeze([
  {
    key: 'real_issue',
    label: "Real issue — I'll handle it in the form build",
    blockingHidden: true,
    noteRequired: false,
  },
  {
    key: 'firm_standard_wording',
    label: "Firm's standard wording",
    blockingHidden: false,
    noteRequired: false,
  },
  {
    key: 'no_form_impact',
    label: 'Does not affect the form',
    blockingHidden: false,
    noteRequired: false,
  },
  {
    key: 'tool_false_alarm',
    label: 'Tool false alarm',
    blockingHidden: false,
    noteRequired: false,
  },
  { key: 'other', label: 'Other', blockingHidden: false, noteRequired: true },
] satisfies CloseReasonOption[]);

/** E24: drops `real_issue` when the gate would still treat an accepted row as open. */
export function closeReasonsFor(row: Row): readonly CloseReasonOption[] {
  return gatesReview(row) ? CLOSE_REASONS.filter((o) => !o.blockingHidden) : CLOSE_REASONS;
}

export type CloseCall = { call: 'accept' } | { call: 'dismiss'; reason: ReasonCode; note: string };

export function toCloseCall(key: CloseReasonKey, note: string): CloseCall {
  if (key === 'real_issue') return { call: 'accept' };
  return { call: 'dismiss', reason: key, note: note.trim() };
}

export const OTHER_NOTE_REQUIRED = 'Add a note for "Other".';

export function closeError(key: CloseReasonKey | null, note: string): string | null {
  if (key === null) return DISMISS_REASON_REQUIRED;
  if (key === 'other' && note.trim() === '') return OTHER_NOTE_REQUIRED;
  return null;
}
