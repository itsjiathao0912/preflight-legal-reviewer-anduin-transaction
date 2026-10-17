import { maskAndClamp, maskQuote } from '@aduin/core';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { downloadBlob } from '../../lib/download';
import { useReview } from '../../state/review';
import { usePackageView } from '../package/package-view';
import { DOCX_MIME } from './exportDocx';
import { buildRequestDocx, dedupeRequests, requestDocxFilename } from './exportRequestDocx';
import '../../styles/package-request.css';

/**
 * "For the GP" group in Counsel questions (intake Phase 3c, AC-I20): one item per missing
 * document with the masked referencing quote, and one DOCX request export. Renders nothing
 * without a package. Requests are not Findings: no memory, gate or server write.
 */
export function GpRequestGroup() {
  const view = usePackageView();
  const showToast = useReview((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const items = useMemo(() => (view ? dedupeRequests(view.requests) : []), [view]);
  if (!view) return null;
  const n = items.length;

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
    <section className="pkg-req" aria-labelledby="pkg-req-h" data-testid="gp-group">
      <div className="pkg-req-head">
        <div>
          <h2 id="pkg-req-h" className="pkg-req-title">
            For the GP <span className="pkg-req-n">{n}</span>
          </h2>
          <p className="pkg-req-help">
            Documents the subscription agreement refers to that are not in this package.
          </p>
        </div>
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
      {n ? (
        <ul className="pkg-req-list">
          {items.map((r) => (
            <li
              key={r.targetKey}
              className="pkg-req-item"
              data-testid="gp-request-item"
              data-target-key={r.targetKey}
            >
              <span className="pkg-req-label">{maskAndClamp(r.label, 200)}</span>
              <span className="pkg-req-count" data-testid="gp-request-count">
                referenced {r.count} time{r.count === 1 ? '' : 's'}
              </span>
              <q className="pkg-req-quote" data-testid="gp-request-quote">
                {maskQuote(r.quote)}
              </q>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pkg-req-none" data-testid="gp-request-none">
          No missing documents. Every referenced document is in the package.
        </p>
      )}
    </section>
  );
}
