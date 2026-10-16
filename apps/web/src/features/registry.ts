// Feature module registry (seam file). Each phase appends ONE line to `features`;
// edits are serialized by the orchestrator. Never reorder or remove entries.
export interface FeatureModule {
  /** Stable id, e.g. "investor-paths". */
  id: string;
  /** Human label for navigation. */
  label: string;
}

export const features: readonly FeatureModule[] = [];
