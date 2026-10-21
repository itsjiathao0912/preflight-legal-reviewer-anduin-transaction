// Feature module registry (seam file). Each later phase APPENDS one line to `features`; edits are
// serialized by the orchestrator. Never reorder or remove entries. When two entries share an `id`,
// the LAST one wins, so a later UI phase replaces a placeholder route by appending its real view.
import type { ComponentType } from 'react';
import type { IconName } from '../icons/sprite';
import { CompareScreen } from './compare/CompareScreen';
import { CounselScreen } from './counsel/CounselScreen';
import { DocumentsView } from './documents/DocumentsView';
import { FindingsScreen } from './review/FindingsScreen';
import { MemoryView } from './memory/MemoryView';
import { placeholder } from './placeholders/PlaceholderView';

export type NavGroupId = 'review' | 'check' | 'firm';

export interface FeatureModule {
  /** Stable id = hash route, e.g. "findings". */
  id: string;
  /** Human label for navigation ("{firm} memory" is resolved by the shell). */
  label: string;
  group: NavGroupId;
  icon: IconName;
  /** Route view. */
  component: ComponentType;
  /** Kept as a route (old links still land) but not shown in the sidebar. */
  hidden?: boolean;
}

export const features: readonly FeatureModule[] = [
  { id: 'findings', label: 'Findings', group: 'review', icon: 'list', component: FindingsScreen },
  {
    id: 'counsel',
    label: 'Questions',
    group: 'review',
    icon: 'counsel',
    component: placeholder('counsel', 'Counsel questions'),
  },
  {
    id: 'structure',
    label: 'Document map',
    group: 'check',
    icon: 'tree',
    component: placeholder('structure', 'Document map'),
  },
  {
    id: 'compare',
    label: 'Compare versions',
    group: 'check',
    icon: 'compare',
    component: placeholder('compare', 'Compare versions'),
  },
  {
    id: 'memory',
    label: 'Firm memory',
    group: 'firm',
    icon: 'memory',
    component: placeholder('memory', 'Firm memory'),
  },
  {
    id: 'documents',
    label: 'Documents',
    group: 'firm',
    icon: 'doc',
    component: placeholder('documents', 'Documents'),
  },
  // Phase 02: the real #structure view replaced the placeholder; superseded by the entry below
  {
    id: 'structure',
    label: 'Document map',
    group: 'check',
    icon: 'tree',
    component: placeholder('structure', 'Document map'),
  },
  // Phase 07: the real #compare view replaces the placeholder (last entry with an id wins)
  {
    id: 'compare',
    label: 'Compare versions',
    group: 'check',
    icon: 'compare',
    component: CompareScreen,
  },
  // Phase 08: the real #counsel view replaces the placeholder (last entry with an id wins)
  // Variance P04: label renamed "Questions"; 22-10-26: "Requests" (route hash unchanged)
  {
    id: 'counsel',
    label: 'Requests',
    group: 'review',
    icon: 'counsel',
    component: CounselScreen,
  },
  // Phase 08b: the real #memory view replaces the placeholder (last entry with an id wins)
  { id: 'memory', label: 'Firm memory', group: 'firm', icon: 'memory', component: MemoryView },
  // Documents: the real #documents view replaces the placeholder (last entry with an id wins)
  { id: 'documents', label: 'Documents', group: 'firm', icon: 'doc', component: DocumentsView },
  // Document map folded into Findings (Form flow and Sources views): the route stays for old links
  // (the shell redirects it to Findings) and leaves the sidebar
  {
    id: 'structure',
    label: 'Document map',
    group: 'check',
    icon: 'tree',
    component: FindingsScreen,
    hidden: true,
  },
];

/** Resolve the view for a route: the last registered module with that id. */
export function featureFor(id: string): FeatureModule | undefined {
  for (let i = features.length - 1; i >= 0; i--) if (features[i]!.id === id) return features[i];
  return undefined;
}

/** Navigation order: first registration position of each id. */
export function navModules(): FeatureModule[] {
  const seen = new Set<string>();
  const out: FeatureModule[] = [];
  for (const f of features) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const m = featureFor(f.id)!;
    if (!m.hidden) out.push(m);
  }
  return out;
}
