import { mask } from '@aduin/core';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Popover } from '../../../components/ui/popover';
import type { BlockView, DocSource, SectionView } from '../../../engine/types';
import { useFilters } from '../../../state/filters';
import {
  saveSubDocScroll,
  takeSubDocScroll,
  useRefView,
  type RefBlock,
} from '../../../state/ref-view';
import { useDocFocus, locateQuote, textRange } from '../../../state/doc-focus';
import { useReview } from '../../../state/review';
import type { Row } from '../model';
import { DocZoomControls, scrollIntoViewVertically, useDocZoom } from '../zoom';

/**
 * Reading view: the document model rendered as React text nodes (never raw HTML, no innerHTML,
 * no resource loads from document content). Finding quotes are wrapped in <mark> by anchor offsets.
 */
interface Mark {
  id: string;
  start: number;
  end: number;
  sev: string;
  dismissed: boolean;
}

interface Mask {
  start: number;
  end: number;
}

/** Docbar label: only where the reading-view text came from (kept short so the bar is one line). */
const SOURCE_LABEL: Record<DocSource, string> = {
  html: 'From HTML',
  pdf: 'From PDF',
  docx: 'From DOCX',
  ocr: 'From scan',
};

const NO_MASKS: Mask[] = [];
const EMPTY: { marks: Mark[]; masks: Mask[] } = { marks: [], masks: NO_MASKS };

function renderBlockText(
  text: string,
  marks: Mark[],
  masks: Mask[],
  selectedId: string | null,
): ReactNode[] {
  const cuts = new Set<number>([0, text.length]);
  for (const m of marks) {
    cuts.add(Math.max(0, Math.min(text.length, m.start)));
    cuts.add(Math.max(0, Math.min(text.length, m.end)));
  }
  for (const m of masks) {
    cuts.add(m.start);
    cuts.add(m.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (b <= a) continue;
    const mk = masks.find((m) => a >= m.start && b <= m.end);
    let content: ReactNode;
    if (mk) {
      if (a !== mk.start) continue;
      const raw = text.slice(mk.start, mk.end);
      content = (
        <span className="mask" aria-label="Sensitive number, masked">
          {mask(raw, [{ start: 0, end: raw.length }])}
        </span>
      );
    } else {
      content = text.slice(a, b);
    }
    const cover = marks.filter((m) => a >= m.start && b <= m.end);
    if (cover.length === 0) {
      out.push(<span key={a}>{content}</span>);
      continue;
    }
    const primary = cover.find((m) => m.id === selectedId) ?? cover[0]!;
    out.push(
      <mark
        key={a}
        className={`q sev-${primary.sev}${primary.id === selectedId ? ' on' : ''}`}
        data-testid="doc-highlight"
        data-finding-id={primary.id}
        style={primary.dismissed ? { opacity: 0.55 } : undefined}
        onClick={() => useReview.getState().select(primary.id)}
      >
        {content}
      </mark>,
    );
  }
  return out;
}

const Block = memo(function Block({
  b,
  marks,
  masks,
  selectedId,
}: {
  b: Pick<BlockView, 'id' | 'kind' | 'text'>;
  marks: Mark[];
  masks: Mask[];
  selectedId: string | null;
}) {
  const kids = renderBlockText(b.text, marks, masks, selectedId);
  const id = `blk-${b.id}`;
  switch (b.kind) {
    case 'heading':
      return <h2 id={id}>{kids}</h2>;
    case 'field':
    case 'table_row':
      return (
        <div id={id} className="fields">
          {kids}
        </div>
      );
    case 'option':
      return (
        <div id={id} className="opt">
          <span className="box" />
          <span>{kids}</span>
        </div>
      );
    default:
      return <p id={id}>{kids}</p>;
  }
});

function JumpMenu({ sections, rows }: { sections: SectionView[]; rows: Row[] }) {
  const kind = useFilters((st) => st.kind);
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Jump to section"
      className="pop-jump"
      testId="jump-menu"
      trigger={
        <button
          className="btn sm"
          type="button"
          data-testid="jump-menu-button"
          aria-label="Jump to section"
          title="Jump to section"
          disabled={sections.length === 0}
        >
          <Icon name="jump" />
          <span className="fv2-jl">Jump to section</span>
          <Icon name="chevd" />
        </button>
      }
    >
      <ul>
        {sections.map((s) => {
          // Variance P02 (D2b): change rows count under the Changes segment only
          const fs = rows.filter(
            (r) =>
              r.f.section_path[0] === s.key &&
              r.status !== 'dismissed' &&
              (kind === 'changes') === (r.f.kind === 'change'),
          );
          const b = fs.filter((r) => r.sev === 'block').length;
          const o = fs.length - b;
          return (
            <li key={s.key}>
              <button
                type="button"
                data-testid="jump-item"
                onClick={() => {
                  setOpen(false);
                  const el = document.getElementById(`blk-${s.blockId}`);
                  if (el) scrollIntoViewVertically(el, 'start');
                }}
              >
                <span className="jl">{s.label}</span>
                <span className="dots">
                  {b ? (
                    <span title={`${b} blocking`}>
                      <Icon name="stop" />
                      {b}
                      <span className="sr"> blocking</span>
                    </span>
                  ) : null}
                  {o ? (
                    <span className="dot-o" title={`${o} other`}>
                      <Icon name="info" />
                      {o}
                      <span className="sr"> other</span>
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}

/** Source File viewer: a package reference file, read-only, with no finding highlights. */
function RefArticle({ name, blocks }: { name: string; blocks: RefBlock[] }) {
  return (
    <article className="paper" data-testid="ref-view-paper">
      <h1>{name}</h1>
      <p className="sub">Reference file · read-only</p>
      {blocks.map((b) => (
        <Block key={b.id} b={b} marks={[]} masks={NO_MASKS} selectedId={null} />
      ))}
    </article>
  );
}

export function DocPane({ rows }: { rows: Row[] }) {
  const result = useReview((s) => s.result);
  const doc = useReview((s) => s.doc);
  const selectedId = useReview((s) => s.selectedId);
  const selectSeq = useReview((s) => s.selectSeq);
  const revealed = useReview((s) => s.revealed);
  const ref = useRefView((s) => s.target);
  const refStatus = useRefView((s) => s.status);
  const refBlocks = useRefView((s) => s.blocks);
  const refSeq = useRefView((s) => s.seq);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoom = useDocZoom(scrollRef, selectedId);
  const docId = doc?.id ?? null;

  // a different open document closes the reference file
  const lastDoc = useRef(docId);
  useEffect(() => {
    if (lastDoc.current === docId) return;
    lastDoc.current = docId;
    if (useRefView.getState().target) useRefView.getState().back();
  }, [docId]);

  // reference file shown: scroll to the target block and flash it; Back: restore the sub doc scroll
  const wasRef = useRef(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (ref && refStatus === 'ready') {
      wasRef.current = true;
      const blk = ref.blockIndex !== null ? refBlocks[ref.blockIndex] : undefined;
      const target = blk ? document.getElementById(`blk-${blk.id}`) : null;
      if (!target) {
        el.scrollTop = 0;
        return;
      }
      scrollIntoViewVertically(target, 'center');
      target.classList.remove('ref-flash');
      void target.offsetWidth;
      target.classList.add('ref-flash');
    } else if (!ref && wasRef.current) {
      wasRef.current = false;
      const top = takeSubDocScroll();
      if (top !== null) el.scrollTop = top;
    }
  }, [ref, refStatus, refBlocks, refSeq]);

  // "Show in document" (no finding needed): scroll to the block, flash it, and keep the block and
  // the quoted span highlighted until the next navigation
  const focus = useDocFocus((s) => s.focus);
  const focusSeq = useDocFocus((s) => s.seq);
  const blockCount = result?.blocks.length ?? 0;
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    for (const old of root.querySelectorAll('.doc-focus'))
      old.classList.remove('doc-focus', 'ref-flash');
    const hl = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS?.highlights;
    hl?.delete('doc-focus');
    if (!focus || ref) return;
    const target = document.getElementById(`blk-${focus.blockId}`);
    if (!target) return;
    scrollIntoViewVertically(target, 'center');
    target.classList.add('doc-focus');
    void target.offsetWidth;
    target.classList.add('ref-flash');
    const H = (globalThis as { Highlight?: new (r: Range) => unknown }).Highlight;
    if (focus.quote && hl && H) {
      const at = locateQuote(target.textContent ?? '', focus.quote);
      const range = at ? textRange(target, at.start, at.end) : null;
      if (range) hl.set('doc-focus', new H(range));
    }
  }, [focus, focusSeq, ref, blockCount]);

  // the next navigation (a finding selected, another document) ends the highlight
  const lastNav = useRef({ selectSeq, docId });
  useEffect(() => {
    const prev = lastNav.current;
    lastNav.current = { selectSeq, docId };
    if (prev.selectSeq !== selectSeq || prev.docId !== docId) useDocFocus.getState().clear();
  }, [selectSeq, docId]);

  const byBlock = useMemo(() => {
    const m = new Map<string, { marks: Mark[]; masks: Mask[] }>();
    for (const r of rows) {
      const k = r.f.anchor.blockId;
      const e = m.get(k) ?? { marks: [], masks: [] };
      e.marks.push({
        id: r.f.id,
        start: r.f.anchor.offsetStart,
        end: r.f.anchor.offsetEnd,
        sev: r.sev,
        dismissed: r.status === 'dismissed',
      });
      e.masks.push(...r.f.sensitive);
      m.set(k, e);
    }
    return m;
  }, [rows]);

  useEffect(() => {
    if (!selectedId || selectSeq === 0) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-testid="doc-highlight"][data-finding-id="${CSS.escape(selectedId)}"]`,
    );
    if (!el) return;
    scrollIntoViewVertically(el, 'center');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [selectedId, selectSeq]);

  return (
    <section className={`docpane${ref ? ' docpane-ref' : ''}`} aria-label="Document reading view">
      {ref ? (
        <div className="refbar" data-testid="ref-view-bar">
          <span className="refbar-t">{`Viewing ${ref.label} (reference file)`}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className="btn ghost sm"
            data-testid="ref-view-back"
            onClick={() => useRefView.getState().back()}
          >
            {`← Back to ${ref.backLabel}`}
          </button>
        </div>
      ) : null}
      <div className="docbar fv2-docbar">
        <span className="fv2-src" title="Reading view: text extracted from the document">
          {ref ? 'Reference file' : SOURCE_LABEL[result?.source ?? 'html']}
        </span>
        <JumpMenu sections={ref ? [] : (result?.sections ?? [])} rows={rows} />
        <DocZoomControls pct={zoom.pct} mode={zoom.state.mode} dispatch={zoom.dispatch} />
      </div>
      <div
        className="scroll docscroll"
        ref={scrollRef}
        style={zoom.style}
        data-dz={zoom.dataDz}
        tabIndex={0}
        role="region"
        aria-label="Document text"
        data-testid="doc-pane"
        data-ref-view={ref ? ref.docId : undefined}
        onScroll={(e) => {
          if (!ref) saveSubDocScroll(e.currentTarget.scrollTop);
        }}
      >
        {ref ? (
          refStatus === 'ready' ? (
            <RefArticle name={ref.name} blocks={refBlocks} />
          ) : (
            <p className="mut" data-testid="ref-view-status">
              {refStatus === 'loading'
                ? `Opening ${ref.label}…`
                : `${ref.label} could not be opened here (scanned or no longer stored).`}
            </p>
          )
        ) : result && doc ? (
          <article className="paper">
            <h1>{doc.name}</h1>
            <p className="sub">
              {doc.fund}
              {doc.version ? ` · ${doc.version}` : ''}
            </p>
            {result.blocks.map((b) => {
              const e = byBlock.get(b.id) ?? EMPTY;
              const sel = e.marks.some((m) => m.id === selectedId) ? selectedId : null;
              return (
                <Block
                  key={b.id}
                  b={b}
                  marks={e.marks}
                  masks={revealed || e.masks.length === 0 ? NO_MASKS : e.masks}
                  selectedId={sel}
                />
              );
            })}
          </article>
        ) : null}
      </div>
    </section>
  );
}
