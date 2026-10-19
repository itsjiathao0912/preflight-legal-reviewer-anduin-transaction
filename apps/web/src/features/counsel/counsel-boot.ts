import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { DOC_REF_UNAVAILABLE, openDocRef } from '../open-document/doc-ref';
import { refreshSheet } from './counsel-share';

/**
 * Counsel mode: open the bundled document the share names on the normal Findings screen, then read
 * the shared state once (the poll keeps it fresh). A ref this build cannot open shows a plain
 * message. Returns true when the document is open.
 */
export async function openSharedDocument(ref: string): Promise<boolean> {
  useShell.getState().setRoute('findings');
  let ok: boolean;
  try {
    ok = await openDocRef(ref);
  } catch {
    ok = false;
  }
  if (!ok) {
    useReview.getState().showToast(DOC_REF_UNAVAILABLE);
    return false;
  }
  await refreshSheet();
  return true;
}
