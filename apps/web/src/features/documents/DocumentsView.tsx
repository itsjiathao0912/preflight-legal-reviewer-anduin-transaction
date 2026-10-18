import { reopenRecent } from '../open-document/open-actions';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';

/** #documents: the documents opened or uploaded this session (same list as the doc switcher). */
export function DocumentsView() {
  const doc = useReview((s) => s.doc);
  const recent = useReview((s) => s.recent);
  const setOpenDoc = useShell((s) => s.setOpenDoc);
  const openBtn = (
    <button
      type="button"
      className="btn pri"
      data-testid="documents-open"
      onClick={() => setOpenDoc(true)}
    >
      Open another document…
    </button>
  );
  return (
    <section className="view" aria-labelledby="h-documents" data-testid="documents-view">
      <header className="pagehead">
        <div className="tt">
          <h1 id="h-documents" tabIndex={-1}>
            Documents
          </h1>
        </div>
      </header>
      <div className="pgbody">
        {recent.length === 0 ? (
          <div className="empty2" data-testid="documents-empty">
            <p className="ph-t">No documents yet. Upload a document or open a sample.</p>
            {openBtn}
          </div>
        ) : (
          <>
            <ul className="doclist" aria-label="Recent documents">
              {recent.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="docrow"
                    data-testid="documents-row"
                    aria-current={doc?.id === d.id ? 'true' : undefined}
                    onClick={() => void reopenRecent(d)}
                  >
                    <span>
                      <b>{d.name}</b>
                      <span className="df">{d.firmName || 'No firm'}</span>
                    </span>
                    <span className="docsrc">{d.source === 'upload' ? 'Upload' : 'Sample'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {openBtn}
          </>
        )}
      </div>
    </section>
  );
}
