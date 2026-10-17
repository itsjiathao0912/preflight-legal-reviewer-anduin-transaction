import type { ReasonCode } from '@aduin/core';
import type { useReviewView } from '../use-review-view';

/** Findings v2 shared types (Interface Contracts, plan findings-v2_PLAN_18-10-26). */
export type GroupKey = 'review' | 'sent' | 'closed';
export type Control = 'ask-counsel' | 'close-issue' | 'move-back';
/** `real_issue` is a modal-only synthetic key (maps to accept); the rest are core reason codes. */
export type CloseReasonKey = 'real_issue' | ReasonCode;
export type ReviewView = ReturnType<typeof useReviewView>;
