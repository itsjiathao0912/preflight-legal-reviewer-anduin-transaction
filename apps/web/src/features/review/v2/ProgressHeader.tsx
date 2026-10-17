import type { Progress } from './groups';

/** D8: "N of M reviewed", a thin bar and Counsel · Closed · Left counts on one row (P-1: from `view.main`). */
export function ProgressHeader({ progress }: { progress: Progress }) {
  const { total, reviewed, sent, closed, left } = progress;
  const width = `${total ? Math.round((reviewed / total) * 100) : 0}%`;
  return (
    <div className="fv2-head" data-testid="progress-header">
      <div className="fv2-prog">
        <b data-testid="progress-text">
          {reviewed} of {total} reviewed
        </b>
        <div
          className="fv2-prog-bar"
          data-testid="progress-bar"
          role="progressbar"
          aria-label="Review progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={reviewed}
        >
          <i style={{ width }} />
        </div>
        <p className="fv2-prog-counts" data-testid="progress-counts">
          <span>
            Counsel <span className="n">{sent}</span>
          </span>
          {' · '}
          <span>
            Closed <span className="n">{closed}</span>
          </span>
          {' · '}
          <span>
            Left <span className="n">{left}</span>
          </span>
        </p>
      </div>
    </div>
  );
}
