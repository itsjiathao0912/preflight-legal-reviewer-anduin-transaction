import { useRefView } from '../../state/ref-view';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import type { FindingView } from '../../engine/types';

/** Open Findings with this finding selected (same path the drawer's "Show in document" uses). */
export function seeInFindings(findingId: string): void {
  if (useRefView.getState().target) useRefView.getState().back();
  useShell.getState().setRoute('findings');
  useShell.getState().setFindingsView('issues');
  useReview.getState().select(findingId);
}

/** The finding in `blockIndex` whose title names `label` (e.g. the Annex F conditional). */
export function findingAt(
  findings: FindingView[] | undefined,
  blockIndex: number,
  label: string,
): FindingView | undefined {
  const l = label.toLowerCase();
  return findings?.find((f) => f.order === blockIndex && f.title.toLowerCase().includes(l));
}

/** A finding about a term (e.g. "Units" is never defined), matched by its title. */
export function findingForTerm(
  findings: FindingView[] | undefined,
  term: string,
): FindingView | undefined {
  const t = `"${term.toLowerCase()}"`;
  return findings?.find(
    (f) => f.issue_class === 'defined_term_issue' && f.title.toLowerCase().includes(t),
  );
}

/** "See in Findings →": jumps to the finding the analyst triages. Never opens the row drawer. */
export function SeeInFindings({ findingId, label }: { findingId: string; label: string }) {
  return (
    <button
      type="button"
      className="btn"
      data-testid="see-in-findings"
      aria-label={`See ${label} in Findings`}
      onClick={(e) => {
        e.stopPropagation();
        seeInFindings(findingId);
      }}
    >
      See in Findings →
    </button>
  );
}
