import { ISSUE_CLASS_LABELS, type IssueClass } from '../findings/taxonomy';
import { limits } from '../config/limits';
import { mask, sensitiveSpans } from '../memory/mask';

/** Worker limits (`CounselQuestionRequestSchema`): 1-6 interpretations of 1-500 chars. */
export const INTERPRETATION_MAX_CHARS = 500;
export const INTERPRETATIONS_MAX = 6;

/** Mask sensitive spans, then clamp to `max` chars (masking first so a clamp never leaks digits). */
export function maskAndClamp(text: string, max: number): string {
  const masked = mask(text, sensitiveSpans(text));
  return masked.length > max ? masked.slice(0, max - 1) + '…' : masked;
}

/** Masked clause quote, <= limits.quoteMaxChars. */
export function maskQuote(quote: string): string {
  return maskAndClamp(quote, limits.quoteMaxChars);
}

/** Clamp a list of interpretations to the Worker limits; empty items are dropped; never empty. */
export function clampInterpretations(items: readonly string[]): string[] {
  const out = items
    .map((s) => maskAndClamp(s.trim(), INTERPRETATION_MAX_CHARS))
    .filter((s) => s.length > 0)
    .slice(0, INTERPRETATIONS_MAX);
  return out.length ? out : ['Please confirm the intended reading of this clause.'];
}

const GENERIC: readonly string[] = [
  'The clause is correct as written; digitize it unchanged.',
  'The clause contains a drafting error; please provide the corrected wording.',
  'The clause should be removed from the subscription document.',
];

const BY_CLASS: Partial<Record<IssueClass, readonly string[]>> = {
  broken_cross_reference: [
    'The reference points to the intended section; the numbering is correct as written.',
    'The reference should point to a different section; please give the correct target.',
    'The reference is obsolete and should be removed.',
  ],
  broken_conditional: [
    'The skip instruction applies as written.',
    'The skip instruction should send the investor to a different item; please give the target.',
    'The condition should be removed and every investor completes the section.',
  ],
  ambiguity: [
    'The clause should be read in its narrower sense.',
    'The clause should be read in its broader sense.',
    'The clause should be redrafted; please provide the intended wording.',
  ],
  logic_contradiction: [
    'The first provision controls.',
    'The second provision controls.',
    'Both provisions should be reconciled; please provide the intended wording.',
  ],
  meaningful_typo: [
    'The text is correct as written.',
    'The text contains a typo; please confirm the intended wording.',
    'The clause should be redrafted.',
  ],
};

/** Deterministic no-LLM draft: interpretations A/B/C for an issue class (clamped to Worker limits). */
export function templateInterpretations(issueClass: string): string[] {
  const set = BY_CLASS[issueClass as IssueClass] ?? GENERIC;
  return clampInterpretations(set);
}

/** Deterministic question wording for the template draft. */
export function templateQuestionText(issueClass: string, location: string): string {
  const label = ISSUE_CLASS_LABELS[issueClass as IssueClass] ?? 'Issue';
  return maskAndClamp(
    `${label} at ${location || 'the cited clause'}: which reading should we digitize?`,
    INTERPRETATION_MAX_CHARS,
  );
}
