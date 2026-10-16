// Feature module registry (seam file). Each later phase APPENDS one line to `features`; edits are
// serialized by the orchestrator. Never reorder or remove entries. When two entries share an `id`,
// the LAST one wins, so a later UI phase replaces a placeholder route by appending its real view.
import type { ComponentType } from 'react';
import type { IconName } from '../icons/sprite';
import { FindingsScreen } from './review/FindingsScreen';
import { placeholder } from './placeholders/PlaceholderView';
import { StructureScreen } from './structure/StructureScreen';

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
}

export const features: readonly FeatureModule[] = [
  { id: 'findings', label: 'Findings', group: 'review', icon: 'list', component: FindingsScreen },
  {
    id: 'counsel',
    label: 'Counsel questions',
    group: 'review',
    icon: 'counsel',
    component: placeholder('counsel', 'Counsel questions'),
  },
  {
    id: 'structure',
    label: 'Structure',
    group: 'check',
    icon: 'tree',
    component: placeholder('structure', 'Structure'),
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
  // Phase 02: the real #structure view replaces the placeholder (last entry with an id wins)
  { id: 'structure', label: 'Structure', group: 'check', icon: 'tree', component: StructureScreen },
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
    out.push(featureFor(f.id)!);
  }
  return out;
}
