import { mask } from '@aduin/core';
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Popover } from '../../../components/ui/popover';
import type { BlockView, SectionView } from '../../../engine/types';
import { useFilters } from '../../../state/filters';
import { useReview } from '../../../state/review';
import type { Row } from '../model';

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
  b: BlockView;
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
          disabled={sections.length === 0}
        >
          <Icon name="jump" />
          Jump to section
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
                  document.getElementById(`blk-${s.blockId}`)?.scrollIntoView({ block: 'start' });
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

export function DocPane({ rows }: { rows: Row[] }) {
  const result = useReview((s) => s.result);
  const doc = useReview((s) => s.doc);
  const selectedId = useReview((s) => s.selectedId);
  const selectSeq = useReview((s) => s.selectSeq);
  const revealed = useReview((s) => s.revealed);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }, [selectedId, selectSeq]);

  return (
    <section className="docpane" aria-label="Document reading view">
      <div className="docbar">
        <span>Reading view · text extracted from HTML</span>
        <JumpMenu sections={result?.sections ?? []} rows={rows} />
      </div>
      <div
        className="scroll docscroll"
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Document text"
        data-testid="doc-pane"
      >
        {result && doc ? (
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
