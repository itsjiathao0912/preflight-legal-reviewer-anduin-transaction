import type { Severity } from '@aduin/core';

/**
 * Severity -> app.html label mapping (the SEV table in design/mockups/app.html).
 * critical (= blocks digitization) -> "Blocks digitization" / chip "Blocks";
 * high -> "Fix before build" / "Fix"; medium and low -> "Note".
 * severity-label.test.ts asserts these strings equal the parsed app.html SEV table.
 */
export type SevKey = 'block' | 'fix' | 'note';

export const SEV: Readonly<
  Record<SevKey, { label: string; short: string; icon: 'stop' | 'warn' | 'info'; rank: number }>
> = Object.freeze({
  block: { label: 'Blocks digitization', short: 'Blocks', icon: 'stop', rank: 0 },
  fix: { label: 'Fix before build', short: 'Fix', icon: 'warn', rank: 1 },
  note: { label: 'Note', short: 'Note', icon: 'info', rank: 2 },
});

export const SEV_KEYS: readonly SevKey[] = ['block', 'fix', 'note'];

export function sevKey(s: Severity): SevKey {
  switch (s) {
    case 'critical':
      return 'block';
    case 'high':
      return 'fix';
    case 'medium':
    case 'low':
      return 'note';
  }
}
