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
