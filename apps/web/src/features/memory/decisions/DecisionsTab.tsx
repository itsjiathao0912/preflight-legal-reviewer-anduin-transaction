import { useMemo, useState } from 'react';
import { DecisionRow, type DecisionRowData } from './DecisionRow';

type StatusFilter = 'all' | 'active' | 'reopened';

/**
 * Decisions tab (AC52): single-line rows, status filter All | Active | Reopened (X6/X8), issue-class
 * filter, truncation note when the firm has more active decisions than the 200 returned.
 */
export function DecisionsTab({
  rows,
  totalActive,
  firmName,
  readOnly,
  classLabel,
  onReopen,
}: {
  rows: readonly DecisionRowData[];
  /** `counts.decisions` (active decisions of the firm). */
  totalActive: number;
  firmName: string;
  readOnly: boolean;
  classLabel: (code: string | null) => string;
  onReopen: (row: DecisionRowData) => void;
}) {
  const [cls, setCls] = useState('all');
  const [st, setSt] = useState<StatusFilter>('all');
  const classes = useMemo(
    () =>
      [...new Set(rows.map((r) => r.issueClass).filter((c): c is string => !!c))].sort((a, b) =>
        classLabel(a).localeCompare(classLabel(b)),
      ),
    [rows, classLabel],
  );
  const clsSel = cls === 'all' || classes.includes(cls) ? cls : 'all';
  const list = rows.filter(
    (r) => (clsSel === 'all' || r.issueClass === clsSel) && (st === 'all' || r.status === st),
  );
  const shownActive = rows.filter((r) => r.status === 'active').length;

  return (
    <div data-testid="memory-decisions">
      <div className="mtool">
        <label className="sr" htmlFor="mem-fCls">
          Filter by issue class
        </label>
        <select
          id="mem-fCls"
          data-testid="memory-filter-class"
          value={clsSel}
          onChange={(e) => setCls(e.target.value)}
        >
          <option value="all">All classes ({rows.length})</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {classLabel(c)} ({rows.filter((r) => r.issueClass === c).length})
            </option>
          ))}
        </select>
        <div className="seg" role="group" aria-label="Filter by status">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['reopened', 'Reopened'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              data-testid="memory-filter-status"
              data-value={v}
              aria-pressed={st === v}
              onClick={() => setSt(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <span
          className="shown"
          role="status"
          aria-live="polite"
          data-testid="memory-decisions-shown"
        >
          {list.length} of {rows.length}
        </span>
      </div>
      {list.length ? (
        <table className="t fx">
          <caption className="sr">Decisions for {firmName || 'this firm'}</caption>
          <thead>
            <tr>
              <th className="c-dec" scope="col">
                Decision
              </th>
              <th scope="col">Quoted passage</th>
              <th className="c-cls" scope="col">
                Issue class
              </th>
              <th className="c-fund" scope="col">
                Fund
              </th>
              <th className="c-who" scope="col">
                Decided by
              </th>
              <th className="c-st" scope="col">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <DecisionRow
                key={`${r.status}:${r.id}`}
                row={r}
                classLabel={classLabel}
                readOnly={readOnly}
                onReopen={onReopen}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty2" data-testid="memory-decisions-empty">
          {rows.length ? 'No decisions match these filters.' : 'No decisions for this firm yet.'}
        </div>
      )}
      {totalActive > shownActive ? (
        <p className="mut" data-testid="memory-decisions-truncated">
          Showing the newest {shownActive} decisions (of {totalActive} active).
        </p>
      ) : null}
      <p className="mut" data-testid="memory-decisions-note">
        Reopened decisions are read from the loaded audit trail; older ones appear after Load more
        in Audit trail.
      </p>
    </div>
  );
}
