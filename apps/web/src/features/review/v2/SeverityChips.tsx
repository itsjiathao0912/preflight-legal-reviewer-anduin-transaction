import { Icon } from '../../../components/ui/icon';
import { useFilters } from '../../../state/filters';
import { SEV, SEV_KEYS } from '../severity';
import type { ReviewView } from './types';

/** D9: Blocks / Fix / Note toggles (same ids and filter as the shipped chips). */
export function SeverityChips({ chips }: { chips: ReviewView['chips'] }) {
  const sev = useFilters((s) => s.sev);
  const set = useFilters((s) => s.set);
  return (
    <div className="chips fv2-chips" role="group" aria-label="Filter by severity">
      {SEV_KEYS.map((k) => (
        <button
          key={k}
          className="chip"
          type="button"
          data-testid={`severity-chip-${k}`}
          data-severity={k}
          aria-pressed={sev === k}
          onClick={() => set({ sev: sev === k ? 'all' : k })}
        >
          <span className={`sv-${k} chip-ic`}>
            <Icon name={SEV[k].icon} />
          </span>
          {SEV[k].short} <span className="n">{chips[k]}</span>
        </button>
      ))}
    </div>
  );
}

const KIND_LABEL = { errors: 'Errors', changes: 'Changes' } as const;

/** True when a filter chip row has something to show (severity, or type when shown). */
export function hasActiveChips(f: { sev: string; kind: string }, kind: boolean): boolean {
  return f.sev !== 'all' || (kind && f.kind !== 'all');
}

/** Active Type and Severity filters as removable chips; each chip clears its own filter. */
export function ActiveFilterChips({ kind }: { kind: boolean }) {
  const k = useFilters((s) => s.kind);
  const sev = useFilters((s) => s.sev);
  const set = useFilters((s) => s.set);
  return (
    <>
      {kind && k !== 'all' ? (
        <button
          className="chip fv2-active-chip"
          type="button"
          data-testid="active-kind-chip"
          aria-label={`Remove filter: ${KIND_LABEL[k]}`}
          onClick={() => set({ kind: 'all' })}
        >
          {KIND_LABEL[k]} <Icon name="x" />
        </button>
      ) : null}
      {sev !== 'all' ? (
        <button
          className="chip fv2-active-chip"
          type="button"
          data-testid="active-severity-chip"
          aria-label={`Remove filter: ${SEV[sev].short}`}
          onClick={() => set({ sev: 'all' })}
        >
          {SEV[sev].short} <Icon name="x" />
        </button>
      ) : null}
    </>
  );
}
