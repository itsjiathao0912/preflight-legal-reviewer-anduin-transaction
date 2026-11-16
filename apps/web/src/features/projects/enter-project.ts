import { useShell } from '../../state/shell';
import { usePackage } from '../../state/package';
import type { Project } from '../../state/projects';
import { openDemoPackage } from '../open-document/package-actions';

/**
 * Entering a project runs the existing open flow unchanged: a seeded project opens its demo
 * package through the Open a document dialog (confirmation table); a project with documents
 * restores the last one; a new project opens the upload dialog.
 */
export async function enterProject(p: Project, restore: () => Promise<void>): Promise<void> {
  if (p.demoPackageId) {
    useShell.getState().setRoute('findings');
    useShell.getState().setOpenDoc(true);
    const r = await openDemoPackage(p.demoPackageId);
    if (!r.ok) useShell.getState().setOpenDoc(true);
    return;
  }
  if (p.docIds.length) {
    await restore();
    return;
  }
  if (!usePackage.getState().draft) useShell.getState().setOpenDoc(true);
}
