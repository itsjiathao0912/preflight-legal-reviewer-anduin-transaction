import { useRefView } from '../../state/ref-view';
import { useReview } from '../../state/review';
import { StageStatus } from '../processing/StageStatus';
import { isScanResult } from '../scan/scan-model';
import { ScanPane } from '../scan/ScanPane';
import { useScan } from '../scan/scan-store';
import { Banners } from './components/Banners';
import { DocPane } from './components/DocPane';
import { useReviewView } from './use-review-view';
import { FindingsPanelV2 } from './v2';
import { BaselineControl } from '../variance/BaselineControl';
import { useShare } from '../counsel/counsel-share';
import { Icon } from '../../components/ui/icon';
import { CounselParticipants, ShareButton, ShareLine } from '../counsel/ShareControls';

export function FindingsScreen() {
  const view = useReviewView();
  const phase = useReview((s) => s.phase);
  const doc = useReview((s) => s.doc);
  const result = useReview((s) => s.result);
  const scanPages = useScan((s) => s.pageCount);
  const refOpen = useRefView((s) => s.target !== null);
  const counselMode = useShare((s) => s.role === 'counsel');
  const readyAt = useShare((s) => s.readyAt);
  const openError = useShare((s) => (s.role === 'counsel' ? s.openError : null));
  // Phase 06e: scanned documents show the page image beside the OCR text
  const scan = isScanResult(result) || (phase === 'loading' && scanPages > 0);

  // removed-unit change rows anchor at the document start with no text: no mark (list only)
  const markRows = view.rows.filter(
    (r) =>
      r.f.kind !== 'change' ||
      (r.f.anchor.offsetEnd > r.f.anchor.offsetStart &&
        view.variance?.meta[r.f.id]?.quote_side !== 'old'),
  );
  return (
    <section className="view" aria-labelledby="h-findings">
      <header className="pagehead" data-testid="findings-header">
        <div className="tt">
          <h1 id="h-findings" tabIndex={-1}>
            Findings
          </h1>
          {doc ? null : (
            <p className="meta" data-testid="findings-meta">
              {openError ?? 'No document open'}
            </p>
          )}
        </div>
        <div className="hacts">
          {readyAt ? (
            <span className="tag t-ok" data-testid="counsel-ready-pill">
              <Icon name="check" />
              Ready to digitize
            </span>
          ) : null}
          {counselMode ? null : <BaselineControl />}
          {counselMode ? null : <CounselParticipants />}
          {counselMode ? null : <ShareButton rows={view.rows} testId="findings-share" />}
          <StageStatus />
        </div>
      </header>
      {counselMode ? null : <ShareLine />}
      <Banners />
      <div className="work fv2-work">
        {scan && !refOpen ? <ScanPane rows={view.rows} /> : <DocPane rows={markRows} />}
        <FindingsPanelV2 view={view} />
      </div>
    </section>
  );
}
