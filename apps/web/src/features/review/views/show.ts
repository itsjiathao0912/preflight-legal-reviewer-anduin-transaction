import { useDocFocus } from '../../../state/doc-focus';
import { useRefView } from '../../../state/ref-view';
import { useShell } from '../../../state/shell';
import { seeInFindings } from '../../structure/SeeInFindings';

/** Scroll the document on the left to a block (closes a referenced-file view first). */
export function showInDoc(blockId: string, quote: string | null = null): void {
  if (useRefView.getState().target) useRefView.getState().back();
  useDocFocus.getState().show(blockId, quote);
}

/** Back to the Issues view with this finding selected (select scrolls to its quote). */
export function openFinding(findingId: string): void {
  useShell.getState().setFindingsView('issues');
  seeInFindings(findingId);
}
