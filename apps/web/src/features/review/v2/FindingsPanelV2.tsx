import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useFilters } from '../../../state/filters';
import { useReview } from '../../../state/review';
import { useShell } from '../../../state/shell';
import { pushSharedQuestions } from '../../counsel/share-flow';
import { useShare } from '../../counsel/counsel-share';
import { questionItems } from '../../variance/owner-groups';
import { CosmeticGroups } from '../../variance/CosmeticGroups';
import { NoBaselineLine } from '../../variance/NoBaselineLine';
import { useVariance, varianceLines } from '../../variance/variance-store';
import { FilterMenu } from '../components/FilterMenu';
import { PreviouslyHandledRow } from '../components/PreviouslyHandledRow';
import { barState, planControl } from './action-plan';
import { ActionBar } from './ActionBar';
import { CloseIssueModal } from './CloseIssueModal';
import { GroupedList } from './GroupedList';
import { flatOrder, groupRows, progressOf, type Grouped } from './groups';
import { PanelResizer } from './PanelResizer';
import { ProgressHeader } from './ProgressHeader';
import { toCloseCall } from './reasons-map';
import { ActiveFilterChips, hasActiveChips } from './SeverityChips';
import type { CloseReasonKey, Control, GroupKey, ReviewView } from './types';
import type { Row } from '../model';
import { usePackageView } from '../../package/package-view';
import { flowBreaks } from '../views/flow-model';
import { FormFlowView } from '../views/FormFlowView';
import { sourceRows, sourcesMissing } from '../views/sources-model';
import { SourcesView } from '../views/SourcesView';
import { ViewSwitch } from '../views/ViewSwitch';
import { useAskOwners } from './use-ask-owners';
import { useFindingActions } from './use-finding-actions';
import { usePanelWidth } from './use-panel-width';
import { focusRow, useShortcuts } from './use-shortcuts';

/**
 * Findings v2 panel (D1-D9, D12, D14): progress, segment, chips + Filter, grouped accordion list,
 * Previously handled, one sticky action bar and the left-edge resizer. `Banners` stays in the
 * screen. Ids kept from the shipped column (E6).
 */
export function FindingsPanelV2({ view }: { view: ReviewView }) {
  const phase = useReview((s) => s.phase);
  const doc = useReview((s) => s.doc);
  const selectedId = useReview((s) => s.selectedId);
  const select = useReview((s) => s.select);
  const memoryState = useReview((s) =>
    !s.memory
      ? 'none'
      : s.memory.pending
        ? 'pending'
        : s.memory.unavailable
          ? 'unavailable'
          : 'ready',
  );
  const kindFilter = useFilters((s) => s.kind);
  const vLine = useVariance((s) => s.line);
  const vIgnored = useVariance((s) => s.ignored);
  const vDoc = useVariance((s) => s.docId);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  // counsel share link: counsel sees the same canvas but answers and comments only
  const counselMode = useShare((s) => s.role === 'counsel');
  // Document map folded in: Issues (this list), Form flow and Sources; counsel sees Issues only
  const panelView = useShell((s) => (counselMode ? 'issues' : s.findingsView));
  const setPanelView = useShell((s) => s.setFindingsView);
  const structure = useReview((s) => s.result?.structure);
  const findings = useReview((s) => s.result?.findings);
  const blocks = useReview((s) => s.result?.blocks);
  const pkg = usePackageView();
  const breaks = useMemo(() => (structure ? flowBreaks(structure).length : 0), [structure]);
  const sources = useMemo(
    () => sourceRows(structure, pkg, findings, blocks),
    [structure, pkg, findings, blocks],
  );
  const viewRef = useRef(view);
  viewRef.current = view;

  const allGroups = useMemo(() => groupRows(view.visible), [view.visible]);
  // counsel share link: questions sent to counsel come first; the rest hides behind a toggle
  const [showAll, setShowAll] = useState(false);
  const groups: Grouped = useMemo(
    () =>
      counselMode && !showAll && allGroups.sent.length
        ? { review: [], sent: allGroups.sent, closed: [] }
        : allGroups,
    [counselMode, showAll, allGroups],
  );
  const order: readonly GroupKey[] | undefined = counselMode
    ? ['sent', 'review', 'closed']
    : undefined;
  const flat = useMemo(
    () => (counselMode ? [...groups.sent, ...groups.review, ...groups.closed] : flatOrder(groups)),
    [counselMode, groups],
  );
  const sentRows = allGroups.sent;
  const answeredCount = sentRows.filter(isAnswered).length;
  const otherCount = allGroups.review.length + allGroups.closed.length;
  // counsel share link: open the first unanswered sent question once per document (never a
  // finding that was not sent); select() bumps selectSeq so the document scrolls to its quote
  const autoOpened = useRef<string | null>(null);
  const docId = doc?.id ?? null;
  useEffect(() => {
    if (!counselMode || phase !== 'ready' || !docId || autoOpened.current === docId) return;
    if (!sentRows.length) return;
    autoOpened.current = docId;
    const first = sentRows.find((r) => !isAnswered(r));
    if (first) select(first.f.id);
    else if (!sentRows.some((r) => r.f.id === useReview.getState().selectedId)) select(null);
  }, [counselMode, phase, docId, sentRows, select]);
  const progress = useMemo(() => progressOf(view.main), [view.main]);
  // R1: the bar and C/X act only on a row the list shows (a filtered-out or Previously handled
  // selection leaves the bar in its "nothing open" state)
  const selectedRow = flat.find((r) => r.f.id === selectedId) ?? null;
  const owners = useAskOwners(selectedRow, view);
  const actions = useFindingActions(view);
  const width = usePanelWidth();
  const [modalFor, setModalFor] = useState<string | null>(null);
  const modalRow = view.rows.find((r) => r.f.id === modalFor) ?? null;

  const ready = phase === 'ready';
  const bar = barState(ready ? selectedRow : null);

  const onControl = (c: Control) => {
    if (actions.busy) return;
    const plan = planControl(c, selectedRow, owners.ask ? { ask: owners.ask } : undefined);
    if (plan.kind === 'open-close-modal') setModalFor(plan.id);
    else if (plan.kind === 'call') {
      const done = plan.call === 'restore' ? actions.moveBack(plan.id) : actions.ask(plan.id);
      // R8: keep keyboard focus on the list after the bar button re-renders or disappears
      void done.then((ok) => {
        const id = useReview.getState().selectedId;
        if (ok && id) focusRow(id);
        // counsel share link: once a link exists, a new "Ask counsel" reaches counsel at once
        if (ok && plan.call !== 'restore') void pushShared();
      });
    }
  };
  const pushShared = async () => {
    if (!useShare.getState().link) return;
    // the view re-renders after the store write; read the fresh rows on the next frame
    await new Promise<void>((r) => setTimeout(r, 0));
    const s = useReview.getState();
    if (!s.doc) return;
    const rows = viewRef.current.rows;
    await pushSharedQuestions({
      doc: s.doc,
      rows,
      findings: rows.map((r) => r.f),
      memory: s.memory,
      items: questionItems(rows),
    });
  };
  const barEnabled = (c: Control): boolean => {
    if (counselMode) return false;
    if (!ready || !selectedRow || actions.busy) return false;
    if (c === 'ask-counsel') return bar.primary === 'ask-counsel' && !owners.askDisabled;
    if (c === 'close-issue') return bar.closeEnabled;
    return bar.moveBackEnabled;
  };
  useShortcuts({ flat, selectedId, select, onControl, barEnabled });

  // R9/R10: the modal closes only after a real save; a failure or a skipped call keeps it open
  const onSubmitClose = async (key: CloseReasonKey, note: string): Promise<boolean> => {
    const id = modalFor;
    if (!id) return false;
    const call = toCloseCall(key, note);
    const ok =
      call.call === 'accept'
        ? await actions.closeRealIssue(id)
        : await actions.closeDismiss(id, call.reason, call.note);
    if (ok) setModalFor(null);
    return ok;
  };

  // P-15: after a save focus the newly selected row; after Esc or Cancel return to the bar button
  const focusAfterClose = (saved: boolean) => {
    const root = width.ref.current;
    if (!root) return;
    const id = saved ? useReview.getState().selectedId : null;
    const rowBtn = id
      ? Array.from(root.querySelectorAll<HTMLElement>('[data-testid="finding-row"]')).find(
          (el) => el.getAttribute('data-finding-id') === id,
        )
      : undefined;
    (rowBtn ?? root.querySelector<HTMLElement>('[data-testid="action-dismiss"]'))?.focus();
  };

  const showKind = ready && !!doc?.firmId;
  const activeChips = useFilters((s) => hasActiveChips(s, showKind));
  const lines = vDoc === doc?.id ? varianceLines({ line: vLine, ignored: vIgnored }) : [];
  const empty = view.visible.length
    ? null
    : kindFilter === 'changes' && !view.hasChanges
      ? 'No changes against a baseline.'
      : view.main.length
        ? 'No findings match these filters.'
        : 'No findings in this document.';

  return (
    <aside
      className="fv2"
      aria-label="Findings"
      data-testid="findings-column"
      data-fv2="1"
      data-memory-state={memoryState}
      ref={width.ref}
    >
      <PanelResizer pct={width.pct} min={width.min} max={width.max} onChange={width.setPct} />
      {counselMode ? null : (
        <ViewSwitch
          value={panelView}
          onChange={setPanelView}
          counts={{ issues: view.main.length, breaks, missing: sourcesMissing(sources) }}
        />
      )}
      {panelView !== 'issues' ? (
        <div
          className="scroll flist fv-alt"
          tabIndex={0}
          role="tabpanel"
          id="fv-view-panel"
          aria-labelledby={`fv-tab-${panelView}`}
          data-testid={`findings-panel-${panelView}`}
        >
          {panelView === 'flow' ? (
            <FormFlowView view={structure} />
          ) : (
            <SourcesView rows={sources} pkg={pkg} />
          )}
        </div>
      ) : (
        <>
          <ProgressHeader
            progress={progress}
            right={
              <FilterMenu
                rows={view.main}
                chips={view.chips}
                counts={showKind ? view.counts : undefined}
              />
            }
          />
          {showKind && lines.length ? (
            <div className="fkind">
              <NoBaselineLine lines={lines} />
            </div>
          ) : null}
          {(counselMode && sentRows.length) || activeChips ? (
            <div className="fhead fv2-fhead">
              {counselMode && sentRows.length ? (
                <span className="fv2-fhead-l" data-testid="counsel-summary">
                  {sentRows.length} {sentRows.length === 1 ? 'question' : 'questions'} for you ·{' '}
                  {answeredCount} answered
                </span>
              ) : null}
              <ActiveFilterChips kind={showKind} />
            </div>
          ) : null}
          <div className="scroll flist" tabIndex={0} role="region" aria-label="Findings list">
            {phase === 'empty' || phase === 'error' ? (
              <div className="empty" data-testid="empty-state">
                <p className="em-p">
                  {phase === 'error'
                    ? 'The document could not be processed.'
                    : 'No document is open.'}
                </p>
                <button className="btn" type="button" onClick={() => setOpenDoc(true)}>
                  <Icon name="doc" />
                  Open a document
                </button>
              </div>
            ) : phase === 'loading' ? (
              <div className="empty" data-testid="loading-state">
                Reading the document…
              </div>
            ) : (
              <>
                {progress.done ? (
                  <div className="fv2-done" data-testid="findings-done">
                    <h2>
                      <Icon name="check" />
                      All findings reviewed
                    </h2>
                    <p>
                      {progress.sent} sent to counsel · {progress.closed} closed
                    </p>
                  </div>
                ) : null}
                <GroupedList
                  groups={groups}
                  selectedId={selectedId}
                  onSelect={(id) => select(id)}
                  view={view}
                  empty={empty}
                  order={order}
                />
                {counselMode && sentRows.length > 0 && otherCount > 0 ? (
                  <button
                    type="button"
                    className="btn ghost"
                    data-testid="counsel-show-all"
                    aria-expanded={showAll}
                    onClick={() => setShowAll((v) => !v)}
                  >
                    {showAll ? 'Show only questions for you' : `Show all findings (${otherCount})`}
                  </button>
                ) : null}
              </>
            )}
            {ready && view.variance && kindFilter !== 'errors' ? (
              <CosmeticGroups
                groups={view.variance.cosmeticGroups}
                count={view.variance.summary.cosmetic}
              />
            ) : null}
            {/* last group inside the scrolling list (never a band over the bar); hidden while empty,
            the count stays in the DOM for the memory flows that read it */}
            {ready ? (
              <div className="fv2-prev" hidden={view.previous.length === 0}>
                <PreviouslyHandledRow items={view.previous} />
              </div>
            ) : null}
          </div>
        </>
      )}
      {counselMode ? null : (
        <>
          <ActionBar
            row={ready ? selectedRow : null}
            busy={actions.busy}
            askDisabled={owners.askDisabled}
            askTitle={owners.askTitle}
            onControl={onControl}
          />
          <CloseIssueModal
            row={modalRow}
            open={modalFor !== null}
            onClose={() => setModalFor(null)}
            onSubmit={onSubmitClose}
            focusAfterClose={focusAfterClose}
          />
        </>
      )}
    </aside>
  );
}

/** Counsel share link: a sent question counts as answered once any answer is recorded. */
function isAnswered(r: Row): boolean {
  const t = r.triage;
  if (!t) return false;
  if (t.counselAnswer) return true;
  return Object.values(t.ownerAnswers ?? {}).some((v) => v != null);
}
