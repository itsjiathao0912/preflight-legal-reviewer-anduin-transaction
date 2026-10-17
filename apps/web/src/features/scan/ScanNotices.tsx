import { useMemo } from 'react';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { isScanResult, ocrBanner, pageStatuses } from './scan-model';
import { useScan } from './scan-store';

/**
 * Read notices for the review view (Phase 06e, AC24): OCR unavailable in this build, OCR down /
 * daily page limit, "Text not extracted for N of M pages", and the DOCX reconstructed-numbering
 * label. Copy is plain text; nothing from the document is rendered here.
 */
export function ScanNotices() {
  const result = useReview((s) => s.result);
  const progress = useScan((s) => s.progress);
  const banner = useMemo(
    () => ocrBanner(pageStatuses(result, progress).values()),
    [result, progress],
  );
  const scan = isScanResult(result) || progress.length > 0;
  return (
    <>
      {scan && banner === 'build' ? (
        <div className="banner on" role="status" data-testid="ocr-unavailable">
          <Icon name="warn" />
          <p className="bn-p">
            <b>OCR unavailable in this build.</b> Page images are shown, but their text was not
            extracted, so no checks ran on those pages.
          </p>
        </div>
      ) : null}
      {scan && (banner === 'service' || banner === 'limit') ? (
        <div className="banner on" role="status" data-testid="ocr-down">
          <Icon name="warn" />
          <p className="bn-p">
            <b>
              {banner === 'limit'
                ? 'OCR page limit reached for today.'
                : 'OCR is not available right now.'}
            </b>{' '}
            Page images are shown; try again later to read the remaining pages.
          </p>
        </div>
      ) : null}
      {result?.notice && (result.source === 'ocr' || result.source === 'pdf') ? (
        <div className="banner on note" role="status" data-testid="scan-notice">
          <Icon name="info" />
          <p className="bn-p">{result.notice}</p>
        </div>
      ) : null}
      {result?.source === 'docx' && (result.reconstructedNumbering || result.notice) ? (
        <div className="banner on note" role="status" data-testid="numbering-notice">
          <Icon name="info" />
          <p className="bn-p">
            {result.reconstructedNumbering ? (
              <>
                <b>Numbering reconstructed.</b> Word list numbers were rebuilt from the file;
                cross-reference findings are marked “based on reconstructed numbering”.
              </>
            ) : null}
            {result.notice && result.notice !== 'reconstructed numbering' ? (
              <> {result.notice}</>
            ) : null}
          </p>
        </div>
      ) : null}
    </>
  );
}
