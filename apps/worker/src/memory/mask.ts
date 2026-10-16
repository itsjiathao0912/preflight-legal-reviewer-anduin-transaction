// Worker-side masking wrapper (instruction E5): wraps ONLY the core `mask`/`sensitiveSpans`
// from the @aduin/core barrel; the core regex lives in packages/core (Phase 02 may widen it).
// Every stored free-text field goes through `maskFree`; the stored snippet is masked BEFORE the
// 300-char truncation so a truncation can never cut a sensitive run in half and leak its head.
import { limits, mask, sensitiveSpans } from '@aduin/core';

export function maskFree(text: string): string {
  return mask(text, sensitiveSpans(text));
}

export function maskOpt(text: string | null | undefined): string | null {
  return text === null || text === undefined ? null : maskFree(text);
}

/** Masked, then truncated to the 300-char snippet cap. */
export function snippetOf(quote: string): string {
  return maskFree(quote).slice(0, limits.snippetMaxChars);
}
