import type { MemoryLabel } from '@aduin/core';

/** Memory label display (values = DATA-MODEL memory_label CHECK list). */
export function memoryLabelText(label: MemoryLabel, fund?: string | null): string {
  switch (label) {
    case 'new':
      return 'New';
    case 'previously_dismissed':
      return 'Previously dismissed';
    case 'already_answered':
      return 'Already answered';
    case 'awaiting_counsel':
      return 'Awaiting counsel';
    case 'dismissed_reconfirm':
      return `Dismissed in ${fund || 'another fund'}, re-confirm`;
  }
}

/** Labels that move a finding out of the main list into "Previously handled (n)". */
export function isPreviouslyHandled(label: MemoryLabel): boolean {
  return (
    label === 'previously_dismissed' || label === 'already_answered' || label === 'awaiting_counsel'
  );
}
