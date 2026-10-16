/**
 * pattern_key (locked spec): `<detector_id>[:<shape>]`. The shape is lowercased, every digit run
 * becomes `#`, whitespace runs become `-`, any character outside `[a-z0-9:#>-]` is removed, and the
 * whole key is capped at 80 chars. Keys never contain `|` (the D1 proposal_key delimiter) and carry
 * no numbers from the document. Single implementation; `findings/make-finding.ts` re-exports it.
 */
export const PATTERN_KEY_MAX = 80;
const DISALLOWED = /[^a-z0-9:#>-]/g;

export function patternKey(detectorId: string, shape?: string): string {
  const raw = shape
    ? `${detectorId}:${shape.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, '-')}`
    : detectorId;
  return raw.replace(DISALLOWED, '').slice(0, PATTERN_KEY_MAX);
}
