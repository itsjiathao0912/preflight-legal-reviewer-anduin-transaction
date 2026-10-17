import { mask, type DiffMode, type DiffResult, type Excerpt, type Segment } from '@aduin/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import './compare.css';
import { Icon } from '../../components/ui/icon';
import { diffInWorker } from '../../engine/client';
import type { IconName } from '../../icons/sprite';
import { useReview } from '../../state/review';
import {
  chipGroups,
  GROUPS,
  itemsOf,
  KIND_LABEL,
  visibleItems,
  type CmpItem,
  type ItemKind,
} from './model';
import { listSources, loadSide, type CompareSource } from './sources';
import { AiSummary } from './AiSummary';

/**
 * #compare (AC19, app.html #v-compare): base / compare pickers with swap, Versions | Siblings
 * (default Versions, D-6), stat chips, change list, clause diff. The diff runs in the engine worker;
 * excerpts arrive RAW with sensitiveSpans and are masked here with core `mask` until Reveal.
 */
type Run =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'done'; result: DiffResult; ms: number }
  | { state: 'error'; side: 'a' | 'b'; code: string };

/** Needs counsel is enabled only for a row linked to a finding of the open document. */
const COUNSEL_NOT_LINKED =
  'Only changes linked to a finding in the open document can be sent to counsel.';

const KIND_ICON: Record<ItemKind, IconName> = {
  added: 'plus',
  removed: 'x',
  renamed: 'compare',
  moved: 'jump',
  changed: 'list',
  fixed: 'check',
  still: 'clock',
  new: 'spark',
  low: 'info',
  common: 'check',
  differing: 'compare',
  only_a: 'doc',
  only_b: 'doc',
};

const KIND_TONE: Record<ItemKind, string> = {
  added: 'b-ok',
  removed: 'b-block',
  renamed: 'b-note',
  moved: 'b-note',
  changed: 'b-fix',
  fixed: 'b-ok',
  still: 'b-st',
  new: 'b-new',
  low: 'b-low',
  common: 'b-st',
  differing: 'b-fix',
  only_a: 'b-note',
  only_b: 'b-note',
};

/** Masked unless revealed (E5): spans index the exact raw string rendered. React text only (E11). */
function Masked({ text, spans }: { text: string; spans: Excerpt['sensitiveSpans'] }) {
  const revealed = useReview((s) => s.revealed);
  return <>{revealed ? text : mask(text, spans)}</>;
}

function ExcerptText({ ex, max }: { ex: Excerpt; max?: number }) {
  const revealed = useReview((s) => s.revealed);
  let t = revealed ? ex.text : mask(ex.text, ex.sensitiveSpans);
  // clipping AFTER masking can never expose a partial raw number
  const cut = max !== undefined && t.length > max;
  if (cut) t = t.slice(0, max);
  return (
    <>
      {ex.clippedStart ? '…' : ''}
      {t}
      {ex.clippedEnd || cut ? '…' : ''}
    </>
  );
}

function SegmentsView({ segs }: { segs: Segment[] }) {
  return (
    <p className="dc" data-testid="cmp-clause-diff">
      {segs.map((s, i) => {
        if (s.op === 'gap') return <span key={i}> … </span>;
        const body = <Masked text={s.text} spans={s.sensitiveSpans} />;
        if (s.op === 'del')
          return (
            <del key={i}>
              <span className="sr">[removed: </span>
              {body}
              <span className="sr">]</span>
            </del>
          );
        if (s.op === 'add')
          return (
            <ins key={i}>
              <span className="sr">[added: </span>
              {body}
              <span className="sr">]</span>
            </ins>
          );
        return <span key={i}>{body}</span>;
      })}
    </p>
  );
}

function hasSpans(it: CmpItem): boolean {
  return (
    !!it.a?.sensitiveSpans.length ||
    !!it.b?.sensitiveSpans.length ||
    !!it.titleEx?.sensitiveSpans.length ||
    !!it.segments?.some((s) => s.sensitiveSpans.length > 0)
  );
}

function Badge({ kind }: { kind: ItemKind }) {
  return (
    <span className={`badge ${KIND_TONE[kind]}`}>
      <Icon name={KIND_ICON[kind]} />
      {KIND_LABEL[kind]}
    </span>
  );
}

function ItemTitle({ it }: { it: CmpItem }) {
  if (it.titleEx) return <ExcerptText ex={it.titleEx} max={110} />;
  return <>{it.title}</>;
}

export function CompareScreen() {
  const [sources, setSources] = useState<CompareSource[]>([]);
  const [base, setBase] = useState('');
  const [cmp, setCmp] = useState('');
  const [mode, setMode] = useState<DiffMode>('version');
  const [run, setRun] = useState<Run>({ state: 'idle' });
  const [filter, setFilter] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const revealed = useReview((s) => s.revealed);
  const toggleReveal = useReview((s) => s.toggleReveal);
  const needsCounsel = useReview((s) => s.needsCounsel);
  const triage = useReview((s) => s.triage);
  const openIds = useReview((s) => s.result?.findings);
  const docId = useReview((s) => s.doc?.id ?? '');
  const seq = useRef(0);

  useEffect(() => {
    let live = true;
    void listSources().then((l) => live && setSources(l));
    return () => {
      live = false;
    };
  }, [docId]);

  const same = !!base && base === cmp;

  useEffect(() => {
    setFilter(null);
    setSel(null);
    if (!base || !cmp || base === cmp) {
      setRun({ state: 'idle' });
      return;
    }
    const my = ++seq.current;
    setRun({ state: 'loading' });
    void (async () => {
      const [a, b] = await Promise.all([loadSide(base), loadSide(cmp)]);
      if (my !== seq.current) return;
      if (!a || !b) {
        setRun({ state: 'error', side: a ? 'b' : 'a', code: 'not_stored' });
        return;
      }
      try {
        const out = await diffInWorker({ a, b, mode });
        if (my !== seq.current) return;
        if ('error' in out) setRun({ state: 'error', ...out.error });
        else setRun({ state: 'done', result: out.result, ms: out.ms });
      } catch {
        if (my === seq.current) setRun({ state: 'error', side: 'a', code: 'unknown' });
      }
    })();
  }, [base, cmp, mode]);

  const result = run.state === 'done' ? run.result : null;
  const items = useMemo(() => (result ? itemsOf(result) : []), [result]);
  const visible = useMemo(() => visibleItems(items, mode, filter), [items, mode, filter]);
  const current = visible.find((i) => i.id === sel) ?? null;
  const openFindingIds = useMemo(() => new Set((openIds ?? []).map((f) => f.id)), [openIds]);
  const labelOf = (k: string) => sources.find((s) => s.key === k)?.label ?? 'this document';

  const pick = (id: string, focus = false) => {
    setSel(id);
    if (focus)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-testid="cmp-item"][data-id="${id}"]`)
          ?.focus({ preventScroll: false }),
      );
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (document.querySelector('[role=dialog]')) return;
        if (filter) setFilter(null);
        else setSel(null);
        return;
      }
      if (e.key !== 'j' && e.key !== 'k') return;
      if (!visible.length) return;
      let i = visible.findIndex((x) => x.id === sel);
      i = e.key === 'j' ? Math.min(visible.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
      pick(visible[i]!.id, true);
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, sel, filter]);

  const swap = () => {
    setBase(cmp);
    setCmp(base);
  };

  const sideLabel = (side: 'a' | 'b') => (side === 'a' ? 'A (base)' : 'B (compare)');

  const meta = same
    ? 'Same document on both sides'
    : result
      ? `${labelOf(base)} → ${labelOf(cmp)} · ${visible.length} ${mode === 'sibling' ? 'clauses' : 'changes'}`
      : 'Pick two documents to compare';

  const options = (
    <>
      <option value="">Choose a document…</option>
      {sources.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </>
  );

  const groups = chipGroups(mode);
  const strip = (
    <div className="stats" aria-label="Summary" data-testid="cmp-stats">
      {groups.map((g, gi) => (
        <span key={g.cap} className="sgrp">
          {gi ? <span className="sdiv" aria-hidden="true" /> : null}
          <span className="gcap">{g.cap}</span>
          {g.chips.map((c) => {
            const n = items.filter(c.match).length;
            return (
              <button
                key={c.k}
                type="button"
                className="chip"
                data-testid="cmp-chip"
                data-k={c.k}
                data-n={n}
                disabled={!n}
                aria-pressed={filter === c.k}
                onClick={() => setFilter(filter === c.k ? null : c.k)}
              >
                <b>{n}</b> {c.label}
              </button>
            );
          })}
        </span>
      ))}
      {filter ? (
        <button
          type="button"
          className="clear"
          data-testid="cmp-clear"
          onClick={() => setFilter(null)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );

  let list: React.ReactNode;
  if (same) {
    list = (
      <div className="empty3" data-testid="cmp-nodiff">
        <Icon name="check" />
        <b>No differences</b>
        <span>Both sides are the same document. Pick two different documents.</span>
      </div>
    );
  } else if (run.state === 'idle') {
    list = (
      <div className="empty3" data-testid="cmp-empty">
        <Icon name="compare" />
        <b>Pick two documents</b>
        <span>
          Choose a base and a compare document above. Samples and your uploads are listed.
        </span>
      </div>
    );
  } else if (run.state === 'loading') {
    list = (
      <div className="empty3" data-testid="cmp-loading" role="status">
        <Icon name="ring" />
        <b>Comparing…</b>
        <span>Reading both documents and aligning their sections.</span>
      </div>
    );
  } else if (run.state === 'error') {
    list = (
      <div className="empty3" data-testid="cmp-error" data-side={run.side} role="alert">
        <Icon name="warn" />
        <b>Could not read this document</b>
        <span>
          Document {sideLabel(run.side)}, {labelOf(run.side === 'a' ? base : cmp)}, could not be
          read ({run.code.replace(/_/g, ' ')}). Pick another document for that side.
        </span>
      </div>
    );
  } else if (result && result.notice !== 'none' && !items.length) {
    list = (
      <div
        className="empty3"
        data-testid={result.notice === 'no_differences' ? 'cmp-nodiff' : 'cmp-nostructure'}
      >
        <Icon name={result.notice === 'no_differences' ? 'check' : 'info'} />
        <b>
          {result.notice === 'no_differences' ? 'No differences' : 'Not enough structure to align'}
        </b>
        <span>
          {result.notice === 'no_differences'
            ? 'The two documents have the same text after normalization.'
            : 'One of the documents has too few sections to compare section by section.'}
        </span>
      </div>
    );
  } else if (!visible.length) {
    list = (
      <div className="empty3">
        <b>Nothing matches this filter.</b>
      </div>
    );
  } else {
    list = GROUPS[mode].map((g) => {
      const l = visible.filter((i) => i.group === g.id);
      if (!l.length) return null;
      return (
        <section key={g.id} className={`grp${g.id === 'low' ? ' muted' : ''}`} aria-label={g.title}>
          <h3>
            {g.title} <span>({l.length})</span>
          </h3>
          <ul className="cards">
            {l.map((it) => (
              <li key={it.id} className={`card${it.id === sel ? ' sel' : ''}`}>
                <button
                  className="chead"
                  type="button"
                  data-testid="cmp-item"
                  data-id={it.id}
                  data-kind={it.kind}
                  data-group={it.group}
                  aria-current={it.id === sel}
                  onClick={() => pick(it.id)}
                >
                  <span className="l1">
                    <Badge kind={it.kind} />
                  </span>
                  <span className="ttl">
                    <ItemTitle it={it} />
                  </span>
                  <span className="l3">
                    <span>{it.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      );
    });
  }

  const counselEnabled = !!current?.findingId && openFindingIds.has(current.findingId);
  const flagged = counselEnabled && triage[current!.findingId!]?.status === 'counsel';

  const detail = !current ? (
    <div className="empty3">
      <b>
        {result && items.length
          ? 'Select a change to see the clauses side by side.'
          : 'The clause comparison shows here.'}
      </b>
    </div>
  ) : (
    <>
      <div className="dh2">
        <div>
          <span className="l1">
            <Badge kind={current.kind} />
            {current.truncated ? (
              <span className="tag t-st">Large change, shown as a whole-block replace</span>
            ) : null}
          </span>
          <h2>
            <ItemTitle it={current} />
          </h2>
        </div>
        {hasSpans(current) ? (
          <button
            type="button"
            className="revealbtn"
            data-testid="cmp-reveal"
            aria-pressed={revealed}
            onClick={toggleReveal}
          >
            <Icon name={revealed ? 'eyeoff' : 'eye'} />
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        ) : null}
      </div>
      <div className="legend" aria-label="Legend">
        <span>
          <ins>added words</ins>
        </span>
        <span>
          <del>removed words</del>
        </span>
      </div>
      {current.segments ? (
        <div className="blk">
          <div className="bh">
            <b>{current.sub}</b>
          </div>
          <SegmentsView segs={current.segments} />
        </div>
      ) : current.a || current.b ? (
        <div className="cols">
          {(['a', 'b'] as const).map((sd) => {
            const ex = current[sd];
            const name = labelOf(sd === 'a' ? base : cmp);
            return (
              <div className="col" key={sd}>
                <div className="ch">
                  <b>{sd === 'a' ? 'Base' : 'Compare'}</b> {name}
                </div>
                {ex ? (
                  <p className="dc">
                    <ExcerptText ex={ex} />
                  </p>
                ) : (
                  <p className="dc void">Not in {name}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="cnote">
        {current.note ? <p>{current.note}</p> : null}
        <p>
          {current.kind === 'low'
            ? 'Rule-based diff · low confidence'
            : 'Rule-based diff · deterministic, no AI'}
        </p>
        <div className="acts">
          <button
            type="button"
            className="btn"
            data-testid="cmp-counsel"
            disabled={!counselEnabled}
            aria-pressed={flagged}
            title={
              counselEnabled
                ? 'Add this finding to the counsel questions draft'
                : COUNSEL_NOT_LINKED
            }
            onClick={() => counselEnabled && void needsCounsel(current.findingId!)}
          >
            <Icon name="counsel" />
            Needs counsel
          </button>
          {!counselEnabled ? <span className="mut">{COUNSEL_NOT_LINKED}</span> : null}
        </div>
      </div>
    </>
  );

  return (
    <section
      className="view"
      id="v-compare"
      aria-labelledby="h-compare"
      data-testid="compare-view"
      data-mode={mode}
    >
      <header className="pagehead">
        <div className="tt">
          <h1 id="h-compare" tabIndex={-1}>
            Compare versions
          </h1>
          <p className="meta" data-testid="cmp-meta">
            {meta}
          </p>
        </div>
      </header>
      <div className="cband">
        <div className="cbar">
          <div className="sent" role="group" aria-label="Documents being compared">
            <select
              data-testid="cmp-base"
              aria-label="Base version (A)"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            >
              {options}
            </select>
            <button
              className="ibtn"
              type="button"
              data-testid="cmp-swap"
              aria-label="Swap base and compare"
              title="Swap base and compare"
              onClick={swap}
            >
              <Icon name="compare" />
            </button>
            <select
              data-testid="cmp-compare"
              aria-label="Compare version (B)"
              value={cmp}
              onChange={(e) => setCmp(e.target.value)}
            >
              {options}
            </select>
          </div>
          <div className="seg" role="group" aria-label="Comparison type">
            {(['version', 'sibling'] as const).map((m) => (
              <button
                key={m}
                type="button"
                data-testid={`cmp-mode-${m}`}
                aria-pressed={mode === m}
                title={m === 'sibling' ? 'Sibling documents (feeder or parallel)' : undefined}
                onClick={() => setMode(m)}
              >
                {m === 'version' ? 'Versions' : 'Siblings'}
              </button>
            ))}
          </div>
        </div>
        {strip}
      </div>
      <div className="cmp">
        <aside className="cl" aria-label={mode === 'sibling' ? 'Clauses' : 'Changes'}>
          <div className="clh">
            <div className="ft">
              <h2>{mode === 'sibling' ? 'Clauses' : 'Changes'}</h2>
              <span className="dim">{result ? `${visible.length} shown` : ''}</span>
            </div>
            {mode === 'sibling' && result ? (
              <p className="mut">
                Common clauses can live once in a shared form; differing clauses become
                entity-specific variants. Common means the same text, not legal equivalence.
              </p>
            ) : null}
          </div>
          <div className="scroll cll" data-testid="cmp-list">
            {list}
          </div>
        </aside>
        <section className="scroll cdp" aria-label="Clause comparison" data-testid="cmp-detail">
          <div className="dpin">
            {result && mode === 'version' && result.notice === 'none' ? (
              <AiSummary result={result} />
            ) : null}
            {detail}
          </div>
        </section>
      </div>
    </section>
  );
}
