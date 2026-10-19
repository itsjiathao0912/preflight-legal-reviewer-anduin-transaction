import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { DOC_REF_UNAVAILABLE, openDocRef } from '../open-document/doc-ref';
import { decodePackageConfig } from '../open-document/package-config';
import { refreshSheet, useShare } from './counsel-share';

/**
 * Counsel mode: open the bundled document the share names on the normal Findings screen (a package
 * with the analyst's types and roles from the link), then read the shared state once (the poll
 * keeps it fresh). A ref this build cannot open shows a plain message that stays on the Findings
 * screen (not only a toast). Returns true when the document is open.
 */
export async function openSharedDocument(
  ref: string,
  cfg: string | null = useShare.getState().docCfg,
): Promise<boolean> {
  useShell.getState().setRoute('findings');
  useShare.getState().setOpenError(null);
  let ok: boolean;
  try {
    ok = await openDocRef(ref, decodePackageConfig(cfg));
  } catch {
    ok = false;
  }
  if (!ok) {
    useShare.getState().setOpenError(DOC_REF_UNAVAILABLE);
    useReview.getState().showToast(DOC_REF_UNAVAILABLE);
    return false;
  }
  await refreshSheet();
  return true;
}
