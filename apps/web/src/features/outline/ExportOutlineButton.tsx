import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { downloadBlob } from '../../lib/download';
import { useReview } from '../../state/review';
import { finalizeOutline } from './finalizeOutline';
import { OutlinePreview } from './OutlinePreview';

/**
 * Structure header action (AC63): exports the form logic outline as JSON (reference only, client
 * side, no AI). Disabled with a reason when the document has no structure.
 */
export function ExportOutlineButton() {
  const outline = useReview((s) => s.result?.outline);
  const docName = useReview((s) => s.doc?.name ?? '');
  const docKey = useReview((s) => s.result?.docHash ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [docKey]);

  const onExport = () => {
    if (!outline) return;
    const r = finalizeOutline(outline, docName);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    downloadBlob(r.filename, r.text, 'application/json');
  };

  return (
    <div className="outline-export">
      <button
        className="btn"
        type="button"
        data-testid="outline-export"
        disabled={!outline}
        aria-describedby={outline ? undefined : 'outline-export-reason'}
        onClick={onExport}
      >
        <Icon name="doc" />
        Export logic outline
      </button>
      {outline ? (
        <OutlinePreview outline={outline} />
      ) : (
        <p className="mut" id="outline-export-reason" data-testid="outline-export-disabled-reason">
          No structure for this document, so there is no outline to export.
        </p>
      )}
      {error ? (
        <p className="mut" role="alert" data-testid="outline-export-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
