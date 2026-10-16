import type { LensId, StructureView } from '@aduin/core';

/** Lens order and labels (app.html #structure segmented control). */
export const LENSES: ReadonlyArray<{ id: LensId; label: string }> = [
  { id: 'sections', label: 'Sections' },
  { id: 'crossrefs', label: 'Cross-references' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'options', label: 'Option groups' },
  { id: 'terms', label: 'Defined terms' },
  { id: 'investors', label: 'Investor types' },
];

/** Default lens on first open (app.html: Cross-references). */
export const DEFAULT_LENS: LensId = 'crossrefs';

/** Rows shown for a lens: "Issues only" (default) or everything. */
export function visibleCount(v: StructureView, lens: LensId, all: boolean): number {
  if (lens === 'investors') return v.investors.types.length;
  if (all) return v.totals[lens];
  if (lens === 'sections') return v.sections.filter((s) => s.depth === 0 && s.flags > 0).length;
  return v[lens].filter((r) => r.issue).length;
}

export function lineFor(v: StructureView, lens: LensId, all: boolean): string {
  if (lens === 'investors')
    return 'Pick the investor type to see what that investor fills in, in document order.';
  if (all) return `Showing everything: ${v.totals[lens]} rows.`;
  return `Issues only: ${visibleCount(v, lens, false)} of ${v.totals[lens]}. Turn on Show everything for the full list.`;
}

export const REF_STATUS = {
  resolved: { cls: 'b-ok', icon: 'check', label: 'Resolved' },
  suspicious: { cls: 'b-fix', icon: 'warn', label: 'Suspicious' },
  unresolved: { cls: 'b-block', icon: 'stop', label: 'Unresolved' },
} as const;

export const TERM_STATUS = {
  ok: { cls: 'b-ok', icon: 'check', label: 'Defined' },
  early: { cls: 'b-fix', icon: 'warn', label: 'Used before defined' },
  twice: { cls: 'b-fix', icon: 'warn', label: 'Defined twice' },
  none: { cls: 'b-block', icon: 'stop', label: 'Not defined' },
  unused: { cls: 'b-fix', icon: 'warn', label: 'Never used' },
  case: { cls: 'b-fix', icon: 'warn', label: 'Capitals differ' },
} as const;

export const CONDITION_KIND = {
  whitelist: { icon: 'check', label: 'Whitelist' },
  role: { icon: 'rule', label: 'Role routing' },
  skip: { icon: 'skip', label: 'Skip' },
  negative: { icon: 'stop', label: 'Negative gate' },
  jump: { icon: 'jump', label: 'Jump' },
} as const;
