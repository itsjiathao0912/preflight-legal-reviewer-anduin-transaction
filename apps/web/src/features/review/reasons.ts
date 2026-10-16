import type { ReasonCode } from '@aduin/core';

/** The 4 app.html REASONS strings mapped to the DATA-MODEL reason_code values (instruction E3). */
export const DISMISS_REASONS: readonly { code: ReasonCode; label: string }[] = Object.freeze([
  { code: 'firm_standard_wording', label: "Law firm's standard wording" },
  { code: 'no_form_impact', label: 'Does not affect the form' },
  { code: 'tool_false_alarm', label: 'Tool false alarm' },
  { code: 'other', label: 'Other' },
]);

export function reasonLabel(code: ReasonCode | undefined | null): string {
  return DISMISS_REASONS.find((r) => r.code === code)?.label ?? '';
}

/** Error copy from app.html when Save is pressed without a reason. */
export const DISMISS_REASON_REQUIRED =
  'Choose a reason before saving. Dismissing without a reason is not allowed.';
