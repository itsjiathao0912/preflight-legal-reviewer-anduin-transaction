import { useMemo, useState } from 'react';
import { isRealMemoryApi, memoryApi } from '../../api/client';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { docRefOf } from '../open-document/demo-refs';
import type { useReviewView } from '../review/use-review-view';

type Rows = ReturnType<typeof useReviewView>['rows'];
import { questionItems } from '../variance/owner-groups';
import { useCounselPoll, useShare } from './counsel-share';
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

/** Initials for an avatar circle: first letters of the first two words. */
export function initialsOf(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function relTime(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const SHOWN = 3;
const NONE: readonly { name: string; joined_at: number }[] = [];

/** Who joined the counsel link (analyst only; callers hide it in counsel mode). Polls ~20 s. */
export function CounselParticipants() {
  const { canShare } = useShareRules();
  useCounselPoll(canShare);
  const people = useShare((s) => s.sheet?.participants ?? NONE);
  if (!people.length) return null;
  const shown = people.slice(0, SHOWN);
  const more = people.length - shown.length;
  const label = `Counsel joined: ${people.map((p) => p.name).join(', ')}`;
  return (
    <div className="cpeople" data-testid="counsel-participants" aria-label={label} role="group">
      {shown.map((p) => (
        <span
          key={p.name}
          className="cperson"
          data-testid="counsel-participant"
          title={`${p.name} joined ${relTime(p.joined_at)}`}
        >
          <span className="av" aria-hidden="true">
            {initialsOf(p.name)}
          </span>
          <span className="cnm">{p.name}</span>
        </span>
      ))}
      {more > 0 ? (
        <span
          className="av cmore"
          data-testid="counsel-participants-more"
          title={people
            .slice(SHOWN)
            .map((p) => `${p.name} joined ${relTime(p.joined_at)}`)
            .join('\n')}
        >
          +{more}
        </span>
      ) : null}
    </div>
  );
}
