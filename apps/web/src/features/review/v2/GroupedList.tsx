import type { FindingView } from '../../../engine/types';
import type { Row } from '../model';
import { AccordionRow } from './AccordionRow';
import type { Grouped } from './groups';
import type { GroupKey, ReviewView } from './types';

const HEADINGS: readonly [GroupKey, string][] = [
  ['review', 'To review'],
  ['sent', 'Sent to counsel'],
  ['closed', 'Closed'],
];

/**
 * D8 groups: To review, Sent to counsel, Closed (counts from `view.visible`, P-7). One `ul`
 * (`findings-list`) holds the groups; each group nests its rows.
 */
export function GroupedList({
  groups,
  selectedId,
  onSelect,
  view,
  empty,
  twins,
}: {
  groups: Grouped;
  selectedId: string | null;
  onSelect(id: string): void;
  view: ReviewView;
  empty: string | null;
  twins?: Readonly<Record<string, FindingView>> | undefined;
}) {
  return (
    <ul className="rows fv2-list" data-testid="findings-list">
      {empty !== null ? (
        <li className="empty" data-testid="empty-state">
          {empty}
        </li>
      ) : (
        HEADINGS.map(([g, label]) => {
          const rows: Row[] = groups[g];
          if (!rows.length) return null;
          return (
            <li
              key={g}
              className="fv2-group"
              data-testid={`group-${g}`}
              data-group={g}
              data-count={rows.length}
            >
              <h3 className="fv2-group-h">
                {label} <span className="n">{rows.length}</span>
              </h3>
              <ul className="rows">
                {rows.map((r) => (
                  <AccordionRow
                    key={r.f.id}
                    row={r}
                    open={r.f.id === selectedId}
                    onToggle={onSelect}
                    view={view}
                    twin={twins?.[r.f.id]}
                  />
                ))}
              </ul>
            </li>
          );
        })
      )}
    </ul>
  );
}
