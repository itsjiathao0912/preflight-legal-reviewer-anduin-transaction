import type { CosmeticGroup } from '@aduin/core';
import { useFilters } from '../../state/filters';
import { capCosmeticGroups, moreGroupsLine } from './select';

/** "Show cosmetic changes (N)": off by default; on, at most 5 grouped rows (never findings). */
export function CosmeticGroups({ groups, count }: { groups: CosmeticGroup[]; count: number }) {
  const show = useFilters((s) => s.showCosmetic);
  const setFilters = useFilters((s) => s.set);
  if (count === 0) return null;
  const capped = capCosmeticGroups(groups, 5);
  const more = moreGroupsLine(capped);
  return (
    <div className="vcos" data-testid="cosmetic-groups">
      <label className="chk">
        <input
          type="checkbox"
          data-testid="show-cosmetic"
          checked={show}
          onChange={(e) => setFilters({ showCosmetic: e.target.checked })}
        />
        <span>Show cosmetic changes ({count})</span>
      </label>
      {show ? (
        <>
          <ul aria-label="Cosmetic changes">
            {capped.shown.map((g) => (
              <li key={g.key} data-testid="cosmetic-group">
                <div>
                  <b>{g.label}</b> · {g.count} change{g.count === 1 ? '' : 's'}
                </div>
                {g.examples.slice(0, 3).map((x, i) => (
                  <div className="gx" key={i}>
                    {x.old || '∅'} → {x.new || '∅'}
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {more ? (
            <p className="mut" data-testid="cosmetic-more">
              {more}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
