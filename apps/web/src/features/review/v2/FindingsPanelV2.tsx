import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useFilters } from '../../../state/filters';
import { useReview } from '../../../state/review';
import { useShell } from '../../../state/shell';
import { CosmeticGroups } from '../../variance/CosmeticGroups';
import { NoBaselineLine } from '../../variance/NoBaselineLine';
import { useVariance, varianceLines } from '../../variance/variance-store';
import { FilterMenu } from '../components/FilterMenu';
import { PreviouslyHandledRow } from '../components/PreviouslyHandledRow';
import { barState, planControl } from './action-plan';
import { ActionBar } from './ActionBar';
import { CloseIssueModal } from './CloseIssueModal';
import { GroupedList } from './GroupedList';
import { flatOrder, groupRows, progressOf } from './groups';
import { KindSegment } from './KindSegment';
import { PanelResizer } from './PanelResizer';
import { ProgressHeader } from './ProgressHeader';
import { toCloseCall } from './reasons-map';
import { SeverityChips } from './SeverityChips';
import type { CloseReasonKey, Control, ReviewView } from './types';
import { useAskOwners } from './use-ask-owners';
import { useFindingActions } from './use-finding-actions';
import { usePanelWidth } from './use-panel-width';
import { useShortcuts } from './use-shortcuts';

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

  const groups = useMemo(() => groupRows(view.visible), [view.visible]);
  const flat = useMemo(() => flatOrder(groups), [groups]);
  const progress = useMemo(() => progressOf(view.main), [view.main]);
  const selectedRow = view.rows.find((r) => r.f.id === selectedId) ?? null;
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
      if (plan.call === 'restore') void actions.moveBack(plan.id);
      else void actions.ask(plan.id);
    }
  };
  const barEnabled = (c: Control): boolean => {
    if (!ready || !selectedRow || actions.busy) return false;
    if (c === 'ask-counsel') return bar.primary === 'ask-counsel' && !owners.askDisabled;
    if (c === 'close-issue') return bar.closeEnabled;
    return bar.moveBackEnabled;
  };
  useShortcuts({ flat, selectedId, select, onControl, barEnabled });

  const onSubmitClose = async (key: CloseReasonKey, note: string) => {
    const id = modalFor;
    if (!id) return;
    const call = toCloseCall(key, note);
    if (call.call === 'accept') await actions.closeRealIssue(id);
    else await actions.closeDismiss(id, call.reason, call.note);
    setModalFor(null);
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
      <ProgressHeader progress={progress} />
      {showKind ? (
        <div className="fkind">
          <KindSegment counts={view.counts} />
          <NoBaselineLine lines={lines} />
        </div>
      ) : null}
      <div className="fhead fv2-fhead">
        {groups.review.length && !empty ? (
          <span className="fv2-fhead-l" aria-hidden="true">
            To review <span className="n">{groups.review.length}</span>
          </span>
        ) : null}
        <SeverityChips chips={view.chips} />
        <FilterMenu rows={view.main} />
      </div>
      <div className="scroll flist" tabIndex={0} role="region" aria-label="Findings list">
        {phase === 'empty' || phase === 'error' ? (
          <div className="empty" data-testid="empty-state">
            <p className="em-p">
              {phase === 'error' ? 'The document could not be processed.' : 'No document is open.'}
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
            />
          </>
        )}
        {ready && view.variance && kindFilter !== 'errors' ? (
          <CosmeticGroups
            groups={view.variance.cosmeticGroups}
            count={view.variance.summary.cosmetic}
          />
        ) : null}
      </div>
      {ready ? <PreviouslyHandledRow items={view.previous} /> : null}
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
    </aside>
  );
}
