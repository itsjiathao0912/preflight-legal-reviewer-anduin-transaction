import { maskOutlineName, OutlineSchema, outlineFilename, type OutlineDraft } from '@aduin/core';
import { e2eForceInvalidOutline } from '../../e2e-hook';

export type FinalizeResult =
  { ok: true; filename: string; text: string } | { ok: false; error: string };

/**
 * Completes the worker's outline draft on the main thread (AC63): adds the masked document name,
 * validates against OutlineSchema v1 and serializes byte-stably. Never returns a partial file.
 */
export function finalizeOutline(draft: OutlineDraft, name: string): FinalizeResult {
  const candidate: unknown = e2eForceInvalidOutline()
    ? { ...draft, schema: 'invalid' }
    : { ...draft, document: { name: maskOutlineName(name), ...draft.document } };
  const parsed = OutlineSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'The outline did not pass its schema check, so nothing was downloaded.',
    };
  }
  return {
    ok: true,
    filename: outlineFilename(name),
    text: JSON.stringify(parsed.data, null, 2),
  };
}
