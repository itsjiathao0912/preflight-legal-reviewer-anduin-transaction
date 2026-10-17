import { useFilters } from '../../../state/filters';
import type { ReviewView } from './types';

/** P-3: All / Errors / Changes segment re-created with the shipped ids. */
export function KindSegment({ counts }: { counts: ReviewView['counts'] }) {
  const kind = useFilters((s) => s.kind);
  const set = useFilters((s) => s.set);
  return (
    <div className="seg fv2-chips" role="group" aria-label="Show" data-testid="kind-segment">
      {(
        [
          ['all', 'All', null],
          ['errors', 'Errors', counts.errors],
          ['changes', 'Changes', counts.changes],
        ] as const
      ).map(([k, label, n]) => (
        <button
          key={k}
          type="button"
          data-testid={`kind-${k}`}
          aria-pressed={kind === k}
          onClick={() => set({ kind: k })}
        >
          {label}
          {n !== null ? <span className="kn">{n}</span> : null}
        </button>
      ))}
    </div>
  );
}
