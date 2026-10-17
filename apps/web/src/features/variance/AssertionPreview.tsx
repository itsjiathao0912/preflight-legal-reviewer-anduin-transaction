import { describeAssertion, type AssertionCandidate } from '@aduin/core';

/** No check can be built from this item (no `assertion_candidate` on the change). */
export const NO_CHECK_LINE = 'No automatic check for this item.';

/**
 * Variance Phase 04 (D1): the one muted preview line of a firm-template answer. The text comes from
 * the core `describeAssertion` over the worker-decoded `assertion_candidate` (never free text).
 */
export function assertionPreviewText(candidate: AssertionCandidate | undefined): string {
  return candidate
    ? `Creates a check for future documents: ${describeAssertion(candidate)}.`
    : NO_CHECK_LINE;
}

export function AssertionPreview({ candidate }: { candidate: AssertionCandidate | undefined }) {
  return (
    <p className="prevline mut" data-testid="assertion-preview" aria-live="polite">
      {assertionPreviewText(candidate)}
    </p>
  );
}
