import { useMemo, useState } from 'react';
import { isRealMemoryApi, memoryApi } from '../../api/client';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { docRefOf } from '../open-document/demo-refs';
import type { useReviewView } from '../review/use-review-view';

type Rows = ReturnType<typeof useReviewView>['rows'];
import { questionItems } from '../variance/owner-groups';
import { useShare } from './counsel-share';
import { DEMO_ONLY, ShareError, shareWithCounsel } from './share-flow';

export function fmtExpiry(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Share rules shared by Questions and Findings: a firm demo document on the live memory service. */
export function useShareRules() {
  const doc = useReview((s) => s.doc);
  const readOnly = useSession((s) => s.readOnly);
  const canSync = !!doc?.firmId && !readOnly && isRealMemoryApi(memoryApi());
  // counsel re-opens bundled files only: uploads and assembled packages cannot be shared
  const shareable = !!docRefOf(doc);
  return { canSync, shareable, canShare: canSync && shareable };
}

/** "Share with counsel" button (analyst only; callers hide it in counsel mode). */
export function ShareButton({ rows, testId = 'counsel-share' }: { rows: Rows; testId?: string }) {
  const doc = useReview((s) => s.doc);
  const memory = useReview((s) => s.memory);
  const showToast = useReview((s) => s.showToast);
  const { shareable, canShare } = useShareRules();
  const items = useMemo(() => questionItems(rows), [rows]);
  const [sharing, setSharing] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      data-testid={testId}
      disabled={!canShare || sharing || !items.length}
      title={
        !shareable
          ? DEMO_ONLY
          : canShare
            ? undefined
            : 'Sharing needs a law firm tag and your own sandbox (not the read-only demo)'
      }
      onClick={async () => {
        if (!doc) return;
        setSharing(true);
        try {
          const l = await shareWithCounsel({
            doc,
            rows,
            findings: rows.map((r) => r.f),
            memory,
            items,
          });
          let copied = false;
          try {
            await navigator.clipboard.writeText(l.url);
            copied = true;
          } catch {
            /* the link stays visible below to copy by hand */
          }
          showToast(
            `${copied ? 'Link copied.' : 'Link ready.'} Valid until ${fmtExpiry(l.expiresAt)}.`,
          );
        } catch (e) {
          showToast(e instanceof ShareError ? e.message : 'The share link could not be created.');
        } finally {
          setSharing(false);
        }
      }}
    >
      <Icon name="counsel" />
      {sharing ? 'Sharing…' : 'Share with counsel'}
    </button>
  );
}

/** The created link with a Copy button. */
export function ShareLine() {
  const doc = useReview((s) => s.doc);
  const link = useShare((s) => s.link);
  const showToast = useReview((s) => s.showToast);
  if (!doc || !link) return null;
  return (
    <div className="shareline" data-testid="counsel-share-line">
      <Icon name="counsel" />
      <span>Counsel link, valid until {fmtExpiry(link.expiresAt)}:</span>
      <input
        type="text"
        readOnly
        aria-label="Counsel link"
        data-testid="counsel-share-url"
        value={link.url}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        className="btn sm"
        data-testid="counsel-share-copy"
        onClick={() =>
          void navigator.clipboard.writeText(link.url).then(
            () => showToast('Link copied.'),
            () => showToast('Select the link and copy it.'),
          )
        }
      >
        Copy link
      </button>
    </div>
  );
}
