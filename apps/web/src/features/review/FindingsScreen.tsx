import { CoverageLine } from '../gate/CoverageLine';
import type { ReasonCode } from '@aduin/core';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { StageStatus } from '../processing/StageStatus';
import { isScanResult } from '../scan/scan-model';
import { ScanPane } from '../scan/ScanPane';
import { useScan } from '../scan/scan-store';
import { Banners } from './components/Banners';
import { DismissModal } from './components/DismissModal';
import { DocPane } from './components/DocPane';
import { FilterMenu } from './components/FilterMenu';
import { FindingRow } from './components/FindingRow';
import { PreviouslyHandledRow } from './components/PreviouslyHandledRow';
import { SEV, SEV_KEYS } from './severity';
import { useReviewView } from './use-review-view';
import { BaselineControl } from '../variance/BaselineControl';
import { ChangeRow } from '../variance/ChangeRow';
import { CosmeticGroups } from '../variance/CosmeticGroups';
import { NoBaselineLine } from '../variance/NoBaselineLine';
import { headerMeta } from '../variance/select';
import { useVariance, varianceLines } from '../variance/variance-store';

function focusRow(id: string) {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        `[data-testid="finding-row"][data-finding-id="${CSS.escape(id)}"]`,
      )
      ?.focus({ preventScroll: true }),
  );
}

export function FindingsScreen() {
  const view = useReviewView();
  const phase = useReview((s) => s.phase);
  const doc = useReview((s) => s.doc);
  const selectedId = useReview((s) => s.selectedId);
  const select = useReview((s) => s.select);
  const dismiss = useReview((s) => s.dismiss);
  const sevFilter = useFilters((s) => s.sev);
  const kindFilter = useFilters((s) => s.kind);
  const vLine = useVariance((s) => s.line);
  const vIgnored = useVariance((s) => s.ignored);
  const vBaseline = useVariance((s) => s.baseline);
  const vDoc = useVariance((s) => s.docId);
  const setFilters = useFilters((s) => s.set);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const result = useReview((s) => s.result);
  const memoryState = useReview((s) =>
    !s.memory
      ? 'none'
      : s.memory.pending
        ? 'pending'
        : s.memory.unavailable
          ? 'unavailable'
          : 'ready',
  );
  const scanPages = useScan((s) => s.pageCount);
  // Phase 06e: scanned documents show the page image beside the OCR text
  const scan = isScanResult(result) || (phase === 'loading' && scanPages > 0);
  const [dismissFor, setDismissFor] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dismissRow = view.rows.find((r) => r.f.id === dismissFor);

  // J/K next / previous finding (ignored while typing or with modifiers; the modal traps focus itself).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dismissFor) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const ids = view.visible.map((r) => r.f.id);
      if (!ids.length) return;
      let i = selectedId ? ids.indexOf(selectedId) : -1;
      i = e.key === 'j' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
      select(ids[i]!);
      focusRow(ids[i]!);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.visible, selectedId, select, dismissFor]);

  // Variance P02: the segment shows for documents with a firm (unknown firm = no baseline ever)
  const showKind = phase === 'ready' && !!doc?.firmId;
  const lines = vDoc === doc?.id ? varianceLines({ line: vLine, ignored: vIgnored }) : [];
  const currentLabel = doc ? [doc.fund, doc.version].filter(Boolean).join(' ') || doc.name : '';
  const baselineLabel = vBaseline?.name ?? 'Baseline';
  // removed-unit change rows anchor at the document start with no text: no mark (list only)
  const markRows = view.rows.filter(
    (r) =>
      r.f.kind !== 'change' ||
      (r.f.anchor.offsetEnd > r.f.anchor.offsetStart &&
        view.variance?.meta[r.f.id]?.quote_side !== 'old'),
  );
  return (
    <section className="view" aria-labelledby="h-findings">
      <header className="pagehead" data-testid="findings-header">
        <div className="tt">
          <h1 id="h-findings" tabIndex={-1}>
            Findings
          </h1>
          <p className="meta" data-testid="findings-meta">
            {doc ? headerMeta(view.counts, view.hasChanges) : 'No document open'}
          </p>
          <CoverageLine placement="header" />
        </div>
        <div className="hacts">
          <BaselineControl />
          <StageStatus />
        </div>
      </header>
      <Banners />
      <div className="work">
        {scan ? <ScanPane rows={view.rows} /> : <DocPane rows={markRows} />}
        <aside
          className="fp"
          aria-label="Findings list"
          data-testid="findings-column"
          data-memory-state={memoryState}
        >
          {showKind ? (
            <div className="fkind">
              <div className="seg" role="group" aria-label="Show" data-testid="kind-segment">
                {(
                  [
                    ['all', 'All', null],
                    ['errors', 'Errors', view.counts.errors],
                    ['changes', 'Changes', view.counts.changes],
                  ] as const
                ).map(([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`kind-${k}`}
                    aria-pressed={kindFilter === k}
                    onClick={() => setFilters({ kind: k })}
                  >
                    {label}
                    {n !== null ? <span className="kn">{n}</span> : null}
                  </button>
                ))}
              </div>
              <NoBaselineLine lines={lines} />
            </div>
          ) : null}
          <div className="fhead">
            <div className="chips" role="group" aria-label="Filter by severity">
              {SEV_KEYS.map((k) => (
                <button
                  key={k}
                  className="chip"
                  type="button"
                  data-testid={`severity-chip-${k}`}
                  aria-pressed={sevFilter === k}
                  onClick={() => setFilters({ sev: sevFilter === k ? 'all' : k })}
                >
                  <span className={`sv-${k} chip-ic`}>
                    <Icon name={SEV[k].icon} />
                  </span>
                  {SEV[k].short} <span className="n">{view.chips[k]}</span>
                </button>
              ))}
            </div>
            <FilterMenu rows={view.main} />
          </div>
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
              <ul className="rows" data-testid="findings-list">
                {view.visible.length ? (
                  view.visible.map((r) =>
                    r.f.kind === 'change' ? (
                      <ChangeRow
                        key={r.f.id}
                        r={r}
                        meta={view.variance?.meta[r.f.id]}
                        selected={r.f.id === selectedId}
                        baselineLabel={baselineLabel}
                        currentLabel={currentLabel}
                        onDismiss={(id, el) => {
                          opener.current = el;
                          setDismissFor(id);
                        }}
                      />
                    ) : (
                      <FindingRow
                        key={r.f.id}
                        r={r}
                        selected={r.f.id === selectedId}
                        onDismiss={(id, el) => {
                          opener.current = el;
                          setDismissFor(id);
                        }}
                      />
                    ),
                  )
                ) : (
                  <li className="empty" data-testid="empty-state">
                    {kindFilter === 'changes' && !view.hasChanges
                      ? 'No changes against a baseline.'
                      : view.main.length
                        ? 'No findings match these filters.'
                        : 'No findings in this document.'}
                  </li>
                )}
              </ul>
            )}
            {phase === 'ready' && view.variance && kindFilter !== 'errors' ? (
              <CosmeticGroups
                groups={view.variance.cosmeticGroups}
                count={view.variance.summary.cosmetic}
              />
            ) : null}
          </div>
          {phase === 'ready' ? <PreviouslyHandledRow items={view.previous} /> : null}
        </aside>
      </div>
      <DismissModal
        open={dismissFor !== null}
        title={dismissRow?.f.title ?? ''}
        reconfirm={dismissRow?.label === 'dismissed_reconfirm'}
        returnFocus={opener}
        onCancel={() => setDismissFor(null)}
        onSave={async (reason: ReasonCode, note: string) => {
          const id = dismissFor;
          if (!id) return null;
          const next = await dismiss(id, reason, note);
          setDismissFor(null);
          return next;
        }}
      />
    </section>
  );
}
