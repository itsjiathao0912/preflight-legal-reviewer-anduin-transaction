import { useEffect, useMemo, type ReactNode } from 'react';
import { Icon } from '../../components/ui/icon';
import type { BlockView } from '../../engine/types';
import { useReview } from '../../state/review';
import type { Row } from '../review/model';
import {
  STATE_LABEL,
  blocksOnPage,
  confLabel,
  highlightFor,
  pageStatuses,
  viewerPages,
  type PageStatus,
} from './scan-model';
import { useScan } from './scan-store';
import './scan.css';

/**
 * Scan viewer (Phase 06e, AC23/AC3/AC4): the page image beside the text read from it.
 *  - per-page state chips (queued / reading / done / failed / no text) that update while OCR runs
 *  - confidence badge per page; pages below 0.6 are marked "Low confidence"
 *  - the selected finding's region is outlined on the image (whole page when no region is known)
 *  - pages without text keep their image and say "Text not extracted"
 * Text is rendered as React text nodes only (OCR output is untrusted data).
 */
function quoteMarks(b: BlockView, rows: Row[], selectedId: string | null): ReactNode {
  const sel = rows.find((r) => r.f.id === selectedId && r.f.anchor.blockId === b.id);
  if (!sel) return b.text;
  const a = Math.max(0, Math.min(b.text.length, sel.f.anchor.offsetStart));
  const z = Math.max(a, Math.min(b.text.length, sel.f.anchor.offsetEnd));
  return (
    <>
      {b.text.slice(0, a)}
      <mark className={`q sev-${sel.sev} on`} data-testid="scan-text-highlight">
        {b.text.slice(a, z)}
      </mark>
      {b.text.slice(z)}
    </>
  );
}

function Chip({ p, n, on, onPick }: { p: PageStatus; n: number; on: boolean; onPick: () => void }) {
  const label = `Page ${n}: ${STATE_LABEL[p.state]}${p.low ? ', low confidence' : ''}`;
  return (
    <li>
      <button
        type="button"
        className={`sc-chip st-${p.state}${p.low ? ' low' : ''}`}
        data-testid="scan-page-chip"
        data-page={n}
        data-state={p.state}
        data-low={p.low ? 'true' : 'false'}
        aria-pressed={on}
        aria-label={label}
        title={p.reason ? `${label} · ${p.reason}` : label}
        onClick={onPick}
      >
        {n}
      </button>
    </li>
  );
}

export function ScanPane({ rows }: { rows: Row[] }) {
  const result = useReview((s) => s.result);
  const doc = useReview((s) => s.doc);
  const selectedId = useReview((s) => s.selectedId);
  const selectSeq = useReview((s) => s.selectSeq);
  const pageCount = useScan((s) => s.pageCount);
  const urls = useScan((s) => s.urls);
  const progress = useScan((s) => s.progress);
  const page = useScan((s) => s.page);
  const setPage = useScan((s) => s.setPage);

  const pages = useMemo(() => viewerPages(result, pageCount), [result, pageCount]);
  const status = useMemo(() => pageStatuses(result, progress), [result, progress]);
  const selected = rows.find((r) => r.f.id === selectedId)?.f;

  // follow the selected finding to its page
  useEffect(() => {
    if (selected?.page !== undefined) setPage(selected.page - 1);
  }, [selected?.page, selectSeq, setPage]);

  const shown = pages.includes(page) ? page : (pages[0] ?? 0);
  const pos = pages.indexOf(shown);
  const st: PageStatus = status.get(shown) ?? { index: shown, state: 'queued', low: false };
  const hl = highlightFor(selected, shown);
  const text = blocksOnPage(result?.blocks ?? [], shown);
  const url = urls[shown];
  const total = result?.pageCount ?? pageCount;
  const done = pages.filter((i) => {
    const s = status.get(i)?.state;
    return s === 'done' || s === 'failed' || s === 'unavailable';
  }).length;

  return (
    <section className="docpane" aria-label="Scanned pages" data-testid="scan-viewer">
      <div className="docbar">
        <span data-testid="scan-summary" aria-live="polite">
          Scanned pages · text read by OCR · {done} of {pages.length} read
        </span>
        <span className="sc-nav">
          <button
            className="btn sm"
            type="button"
            data-testid="scan-prev"
            disabled={pos <= 0}
            onClick={() => setPage(pages[pos - 1] ?? shown)}
          >
            Previous
          </button>
          <span data-testid="scan-page-label">
            Page {shown + 1} of {total}
          </span>
          <button
            className="btn sm"
            type="button"
            data-testid="scan-next"
            disabled={pos < 0 || pos >= pages.length - 1}
            onClick={() => setPage(pages[pos + 1] ?? shown)}
          >
            Next
          </button>
        </span>
      </div>
      <div
        className="scroll docscroll"
        tabIndex={0}
        role="region"
        aria-label="Scanned page and its text"
        data-testid="doc-pane"
      >
        <ol className="sc-chips" aria-label="Page reading progress" data-testid="scan-progress">
          {pages.map((i) => (
            <Chip
              key={i}
              p={status.get(i) ?? { index: i, state: 'queued', low: false }}
              n={i + 1}
              on={i === shown}
              onPick={() => setPage(i)}
            />
          ))}
        </ol>
        <div className="sc-view">
          <figure className="sc-fig" data-testid="scan-page" data-page={shown + 1}>
            {url ? (
              <div className="sc-img-wrap">
                <img
                  className="sc-img"
                  src={url}
                  alt={`Scanned page ${shown + 1}${doc ? ` of ${doc.name}` : ''}`}
                  data-testid="scan-page-image"
                  draggable={false}
                />
                {hl?.kind === 'region' ? (
                  <span
                    className="sc-region"
                    data-testid="scan-region"
                    data-kind="region"
                    style={{
                      left: `${hl.x * 100}%`,
                      top: `${hl.y * 100}%`,
                      width: `${hl.w * 100}%`,
                      height: `${hl.h * 100}%`,
                    }}
                  />
                ) : null}
                {hl?.kind === 'page' ? (
                  <span className="sc-region page" data-testid="scan-region" data-kind="page" />
                ) : null}
              </div>
            ) : (
              <div className="sc-img-wait" data-testid="scan-page-image-pending">
                Preparing the page image…
              </div>
            )}
            <figcaption className="sc-cap">Page {shown + 1}</figcaption>
          </figure>
          <div className="sc-text" aria-label={`Text read from page ${shown + 1}`}>
            <div className="sc-meta">
              <span className={`badge b-st sc-state st-${st.state}`} data-testid="scan-page-state">
                {STATE_LABEL[st.state]}
              </span>
              {st.state === 'done' && st.conf !== undefined ? (
                st.low ? (
                  <span
                    className="badge b-fix"
                    data-testid="scan-confidence"
                    data-low="true"
                    title="OCR confidence below 0.6: check this page against the image"
                  >
                    <Icon name="warn" />
                    Low confidence {confLabel(st.conf)}
                  </span>
                ) : (
                  <span className="badge b-ok" data-testid="scan-confidence" data-low="false">
                    Confidence {confLabel(st.conf)}
                  </span>
                )
              ) : null}
            </div>
            {st.state === 'done' && st.low ? (
              <p className="sc-warn" data-testid="scan-low-confidence">
                The text on this page may be wrong. Findings from it are less certain; compare with
                the image before you rely on them.
              </p>
            ) : null}
            {st.state === 'failed' || st.state === 'unavailable' ? (
              <p className="sc-warn" data-testid="scan-no-text">
                Text not extracted for this page{st.reason ? ` · ${st.reason}` : ''}. The page image
                is still shown.
              </p>
            ) : null}
            {st.state === 'queued' || st.state === 'running' ? (
              <p className="sc-wait">Reading this page…</p>
            ) : null}
            {text.length ? (
              <div className="sc-lines" data-testid="scan-text">
                {text.map((b) => (
                  <p
                    key={b.id}
                    id={`blk-${b.id}`}
                    className={`sc-line k-${b.kind}`}
                    data-testid="scan-line"
                  >
                    {quoteMarks(b, rows, selectedId)}
                  </p>
                ))}
              </div>
            ) : st.state === 'done' ? (
              <p className="sc-wait">No text lines on this page.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
