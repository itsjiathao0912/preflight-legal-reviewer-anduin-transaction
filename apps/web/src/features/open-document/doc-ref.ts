import { DOC_REF_RE } from '@aduin/core';
import { usePackage } from '../../state/package';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { openSample } from './open-actions';
import { openDemoPackage, runPackageDraft } from './package-actions';
import { applyPackageConfig, type PackageConfig } from './package-config';
import { loadFirms, loadManifest } from './samples';

export { docRefOf, forgetDemoPackagesForTest, rememberDemoPackage } from './demo-refs';

/** Shown when a link names a document this build does not bundle. */
export const DOC_REF_UNAVAILABLE = 'This link points to a document that is not available.';

/**
 * Open the bundled document a share names, through the normal open paths (engine, highlights,
 * Findings). Returns false when the ref is malformed or the bundle has no such document.
 * A package ref re-applies the analyst's types and roles (`cfg`, from the link) and confirms every
 * row, so the draft can run and the findings match the analyst's (see package-config.ts).
 */
export async function openDocRef(ref: string, cfg: PackageConfig | null = null): Promise<boolean> {
  if (!DOC_REF_RE.test(ref)) return false;
  const [kind, id] = ref.split(':') as ['package' | 'sample', string];
  if (kind === 'sample') {
    const entry = (await loadManifest()).find((s) => s.id === id);
    if (!entry || entry.disabled) return false;
    await openSample(entry, await loadFirms());
    return useReview.getState().doc?.sampleId === id;
  }
  const prepared = await openDemoPackage(id);
  if (!prepared.ok) return false;
  applyPackageConfig(cfg);
  if (!usePackage.getState().draftReadiness().ok) return false;
  await runPackageDraft();
  useShell.getState().setRoute('findings');
  return useReview.getState().phase === 'ready';
}
