import type { ReasonCode } from '@aduin/core';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useFilters } from '../../state/filters';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';
import { StageStatus } from '../processing/StageStatus';
import { Banners } from './components/Banners';
import { DismissModal } from './components/DismissModal';
import { DocPane } from './components/DocPane';
import { FilterMenu } from './components/FilterMenu';
import { FindingRow } from './components/FindingRow';
import { PreviouslyHandledRow } from './components/PreviouslyHandledRow';
import { SEV, SEV_KEYS } from './severity';
import { useReviewView } from './use-review-view';

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
  const setFilters = useFilters((s) => s.set);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
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

  const blocked = view.gate.reasons.length;
  return (
    <section className="view" aria-labelledby="h-findings">
      <header className="pagehead" data-testid="findings-header">
        <div className="tt">
          <h1 id="h-findings" tabIndex={-1}>
            Findings
          </h1>
          <p className="meta" data-testid="findings-meta">
            {doc ? `${view.open} open · ${blocked} block digitization` : 'No document open'}
          </p>
        </div>
        <StageStatus />
      </header>
      <Banners />
      <div className="work">
        <DocPane rows={view.rows} />
        <aside className="fp" aria-label="Findings list" data-testid="findings-column">
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
          <div className="scroll flist" tabIndex={-1}>
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
                  view.visible.map((r) => (
                    <FindingRow
                      key={r.f.id}
                      r={r}
                      selected={r.f.id === selectedId}
                      onDismiss={(id, el) => {
                        opener.current = el;
                        setDismissFor(id);
                      }}
                    />
                  ))
                ) : (
                  <li className="empty" data-testid="empty-state">
                    {view.main.length
                      ? 'No findings match these filters.'
                      : 'No findings in this document.'}
                  </li>
                )}
              </ul>
            )}
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
