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

/** Change finding fields the deterministic `version_drift` draft needs (Variance MVP). */
export interface VersionDriftDraft {
  change_type: string;
  old_text: string;
  new_text: string;
}

/** Embedded clause text inside an option: masked, then clamped so the option stays <= 500. */
const EMBED_MAX = 300;
const quoted = (s: string) => `"${maskAndClamp(s.replace(/\s+/g, ' ').trim(), EMBED_MAX)}"`;

/**
 * Deterministic no-LLM draft for a change finding (`version_drift` + change type): options A/B/C
 * built from the old and new text. Masked and clamped to the Worker limits; the intent field is
 * human-only and never drafted here.
 */
export function templateVersionDriftInterpretations(c: VersionDriftDraft): string[] {
  const oldT = c.old_text.trim();
  const newT = c.new_text.trim();
  if (c.change_type === 'new' || !oldT)
    return clampInterpretations([
      `The new text is intended; digitize it as written: ${quoted(newT || '(new text)')}.`,
      'The new text was added by mistake; remove it and keep the baseline form.',
      'The new text needs changes; please provide the intended wording.',
    ]);
  if (!newT)
    return clampInterpretations([
      `The removal is intended; do not digitize the baseline text: ${quoted(oldT)}.`,
      'The text was removed by mistake; restore the baseline wording.',
      'The text should be replaced; please provide the intended wording.',
    ]);
  return clampInterpretations([
    `Use the new wording: ${quoted(newT)}.`,
    `Keep the baseline wording: ${quoted(oldT)}.`,
    'Neither wording is right; please provide the intended wording.',
  ]);
}

/** Deterministic question wording for a change finding. */
export function templateVersionDriftQuestion(c: VersionDriftDraft, location: string): string {
  const what =
    c.change_type === 'new' ? 'New text' : c.new_text.trim() ? 'Changed text' : 'Removed text';
  return maskAndClamp(
    `${what} vs the baseline at ${location || 'the cited clause'}: which version should we digitize?`,
    INTERPRETATION_MAX_CHARS,
  );
}
