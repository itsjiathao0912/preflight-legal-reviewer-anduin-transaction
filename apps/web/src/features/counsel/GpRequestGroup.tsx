import { maskAndClamp, maskQuote, type DocumentRequest } from '@aduin/core';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { downloadBlob } from '../../lib/download';
import { useReview } from '../../state/review';
import { usePackageView } from '../package/package-view';
import { DOCX_MIME } from './exportDocx';
import { matchesFilters, snipQuote, type QuestionFilters, type RowFacts } from './questions-table';
import { SEV } from '../review/severity';
import { buildRequestDocx, dedupeRequests, requestDocxFilename } from './exportRequestDocx';
import '../../styles/package-request.css';

/** Filter facts of the GP request row: who GP, severity Fix, waiting while a document is missing. */
export const gpRequestFacts = (n: number): RowFacts => ({
  owner: 'gp',
  sev: 'fix',
  waiting: n > 0,
});

/** Deduped missing-document requests of the open package (null without a package). */
export function useGpRequests(): DocumentRequest[] | null {
  const view = usePackageView();
  return useMemo(() => (view ? dedupeRequests(view.requests) : null), [view]);
}

/**
 * "For the GP" request as ONE row of the Questions table (intake Phase 3c, AC-I20; table layout
 * 20-10-26): "Send N missing documents", who GP, severity Fix. Expanded: one small tag per missing
 * document (masked referencing quote, starting at a word boundary) and the DOCX request export.
 * Renders nothing without a package, or when the filters exclude it. Requests are not Findings: no
 * memory, gate or server write.
 */
export function GpRequestGroup({
  open = false,
  onToggle,
  filters,
}: {
  open?: boolean;
  onToggle?: () => void;
  filters?: QuestionFilters;
}) {
  const view = usePackageView();
  const showToast = useReview((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => (view ? dedupeRequests(view.requests) : []), [view]);
  if (!view) return null;
  const n = items.length;
  if (filters && !matchesFilters(gpRequestFacts(n), filters)) return null;

  const onExport = async () => {
    setBusy(true);
    try {
      const meta = {
        firm: view.firmId ? view.firmName : null,
        fund: view.fund,
        version: view.version,
      };
      const blob = await buildRequestDocx(meta, items);
      downloadBlob(requestDocxFilename(meta), blob, DOCX_MIME);
      showToast(`Request exported: ${n} document${n === 1 ? '' : 's'}.`);
    } catch {
      showToast('The request could not be exported. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={open ? 'row sel pkg-req' : 'row pkg-req'}
      data-testid="gp-group"
      data-count={n}
      aria-label="For the GP"
    >
      <button
        className="rowb qt-grid"
        type="button"
        data-testid="gp-request-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="qt-chev" aria-hidden="true">
          <Icon name="chev" />
        </span>
        <span className="qn" aria-hidden="true">
          –
        </span>
        <span className="t">
          {n ? (
            `Send ${n} missing document${n === 1 ? '' : 's'}`
          ) : (
            <span data-testid="gp-request-none">No missing documents</span>
          )}
        </span>
        <span className="qt-who">
          <span className="sr">Who: </span>
          <span className="ochip">GP</span>
        </span>
        <span className="qt-sev sv-fix">
          <Icon name={SEV.fix.icon} />
          <span className="sr">Severity: </span>
          <span>{SEV.fix.short}</span>
        </span>
        <span className="qt-st">
          {n ? (
            <span className="tag t-st qt-wait">Waiting</span>
          ) : (
            <span className="tag t-ok">
              <Icon name="check" />
              Answered
            </span>
          )}
        </span>
      </button>
      {open ? (
        <div className="rbody">
          <p className="pkg-req-help">
            {n
              ? 'Documents the subscription agreement refers to that are not in this package.'
              : 'Every referenced document is in the package.'}
          </p>
          {n ? (
            <ul className="pkg-req-list">
              {items.map((r) => {
                const quote = snipQuote(maskQuote(r.quote));
                return (
                  <li
                    key={r.targetKey}
                    className="pkg-req-item"
                    data-testid="gp-request-item"
                    data-target-key={r.targetKey}
                    title={quote}
                  >
                    <span className="pkg-req-label">{maskAndClamp(r.label, 200)}</span>
                    <span className="pkg-req-count" data-testid="gp-request-count">
                      referenced {r.count} time{r.count === 1 ? '' : 's'}
                    </span>
                    <q className="pkg-req-quote" data-testid="gp-request-quote">
                      {quote}
                    </q>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="acts">
            <button
              type="button"
              className="btn"
              data-testid="gp-request-export"
              disabled={busy}
              onClick={() => void onExport()}
            >
              <Icon name="doc" />
              Export request DOCX
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
