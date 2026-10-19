import type { LensId, StructureView } from '@aduin/core';

/** Lens labels (sub-headings inside the three Structure tabs). */
export const LENS_LABEL: Record<LensId, string> = {
  sections: 'Sections',
  crossrefs: 'Cross-references',
  conditions: 'Conditions',
  options: 'Option groups',
  terms: 'Defined terms',
  investors: 'Investor types',
};

/** Intake Phase 3a: the Package group id (web-local, not a core LensId). */
export const PACKAGE_LENS = 'package';

/**
 * The Structure screen has three tabs. Sections is the map; Logic merges cross-references,
 * conditions, option groups and investor types; Terms & package merges defined terms and the
 * package group (only when a package is open).
 */
export type StructureTabId = 'sections' | 'logic' | 'terms';
export const DEFAULT_TAB: StructureTabId = 'sections';

/** Core lenses shown in each tab, in order. */
export const TAB_LENSES: Record<StructureTabId, readonly LensId[]> = {
  sections: ['sections'],
  logic: ['crossrefs', 'conditions', 'options', 'investors'],
  terms: ['terms'],
};

export function tabsFor(hasPackage: boolean): ReadonlyArray<{ id: StructureTabId; label: string }> {
  return [
    { id: 'sections', label: 'Sections' },
    { id: 'logic', label: 'Logic' },
    { id: 'terms', label: hasPackage ? 'Terms & package' : 'Defined terms' },
  ];
}

/** Summed issue count of a tab (the tab badge). */
export function tabCount(v: StructureView, tab: StructureTabId): number {
  return TAB_LENSES[tab].reduce((n, l) => n + (v.counts[l] ?? 0), 0);
}

/** Rows shown for a lens: "Issues only" (default) or everything. */
export function visibleCount(v: StructureView, lens: LensId, all: boolean): number {
  if (lens === 'investors') return v.investors.types.length;
  if (all) return v.totals[lens];
  if (lens === 'sections') return v.sections.filter((s) => s.depth === 0 && s.flags > 0).length;
  return v[lens].filter((r) => r.issue).length;
}

/** The status line under the tabs; investor types are a picker, not a row list, so not summed. */
export function lineFor(v: StructureView, tab: StructureTabId, all: boolean): string {
  const lenses = TAB_LENSES[tab].filter((l) => l !== 'investors');
  const total = lenses.reduce((n, l) => n + v.totals[l], 0);
  if (all) return `Showing everything: ${total} rows.`;
  const shown = lenses.reduce((n, l) => n + visibleCount(v, l, false), 0);
  return `Issues only: ${shown} of ${total}. Turn on Show everything for the full list.`;
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
