import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { aiRunFresh, useAiLane } from './ai-lane';
import { markUserIntent } from './turnstile';
import { BANNERS } from './banner-map';

function resumeText(at: number | null): string {
  if (at === null) return '';
  const d = new Date(at);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && at - Date.now() > 60_000)
    return ' AI resumes at 00:00 UTC.';
  const s = Math.max(1, Math.round((at - Date.now()) / 1000));
  return s >= 120 ? ` AI resumes in about ${Math.round(s / 60)} minutes.` : ' AI resumes shortly.';
}

/**
 * AI lane notices: one downgrade banner per reason (naming the reason and what is skipped), the
 * "Run AI on this sample" line for samples without a saved result, and the firm-rules cap notice.
 * Nothing renders when the lane is off or idle (preview build: fail soft, no banner).
 */
export function AiBanner() {
  const lane = useAiLane();
  const aiOn = useSession((s) => s.aiOn);
  const doc = useReview((s) => s.doc);
  if (!aiOn || !doc || lane.docId !== doc.id) return null;
  const copy = lane.banner ? BANNERS[lane.banner] : null;
  return (
    <>
      {copy && lane.banner ? (
        <div className="banner on" role="status" data-testid="ai-banner" data-reason={lane.banner}>
          <Icon name="warn" />
          <p className="bn-p">
            <b>AI review skipped: {copy.reason}.</b> Rules, memory and the gate still work;
            ambiguity, contradiction and typo passes are skipped.
            {copy.resume === 'midnight' || copy.resume === 'retry_after'
              ? resumeText(lane.resetAt)
              : ''}
          </p>
          {copy.resume === 'manual' ? (
            <button
              className="btn sm"
              type="button"
              data-testid="ai-retry"
              onClick={() => {
                markUserIntent();
                void aiRunFresh();
              }}
            >
              <Icon name="undo" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {lane.status === 'not_precomputed' ? (
        <div className="banner on note" role="status" data-testid="ai-not-precomputed">
          <Icon name="info" />
          <p className="bn-p">
            <b>No saved AI review for this sample.</b> Rule findings are complete. Running AI uses
            one of today’s fresh-AI documents.
          </p>
          <button
            className="btn sm"
            type="button"
            data-testid="ai-run-sample"
            onClick={() => {
              markUserIntent();
              void aiRunFresh();
            }}
          >
            <Icon name="spark" />
            Run AI on this sample
          </button>
        </div>
      ) : null}
      {lane.rulesNotice && (lane.status === 'fresh' || lane.status === 'cache') ? (
        <div className="banner on note" role="status" data-testid="ai-rules-notice">
          <Icon name="info" />
          <p className="bn-p">
            <b>{lane.rulesNotice}.</b> The firm has more rules than the AI can take at once; the
            first rules in order were given as context.
          </p>
        </div>
      ) : null}
    </>
  );
}
