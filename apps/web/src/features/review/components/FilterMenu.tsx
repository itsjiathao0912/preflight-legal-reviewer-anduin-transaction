import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Popover } from '../../../components/ui/popover';
import {
  DEFAULT_FILTERS,
  useFilters,
  type SortKey,
  type StatusFilter,
} from '../../../state/filters';
import { classOptions, detectorOptions, type Row } from '../model';

const STATUS: [StatusFilter, string][] = [
  ['active', 'Active'],
  ['open', 'Open'],
  ['accepted', 'Accepted'],
  ['counsel', 'Needs counsel'],
  ['dismissed', 'Dismissed'],
  ['all', 'All'],
];
const SORT: [SortKey, string][] = [
  ['sev', 'Severity'],
  ['doc', 'Document order'],
  ['cls', 'Class'],
];

export function FilterMenu({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(false);
  const f = useFilters();
  const n =
    Number(f.cls !== DEFAULT_FILTERS.cls) +
    Number(f.status !== DEFAULT_FILTERS.status) +
    Number(f.sort !== DEFAULT_FILTERS.sort) +
    Number(f.det !== DEFAULT_FILTERS.det);
  const classes = classOptions(rows);
  const dets = detectorOptions(rows);
  if (f.cls !== 'all' && !classes.some((c) => c.value === f.cls))
    classes.push({ value: f.cls, label: f.cls });
  if (f.det !== 'all' && !dets.includes(f.det)) dets.push(f.det);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Filter and sort findings"
      className="pop-filt"
      testId="filter-menu"
      trigger={
        <button className="btn sm" type="button" data-testid="filter-button">
          <Icon name="filter" />
          Filter
          {n ? (
            <span className="fc" data-testid="filter-count">
              <span className="sr">{n} active: </span>
              {n}
            </span>
          ) : null}
          <Icon name="chevd" />
        </button>
      }
    >
      <label>
        Class
        <select
          data-testid="filter-class"
          value={f.cls}
          onChange={(e) => f.set({ cls: e.target.value })}
        >
          <option value="all">All classes</option>
          {classes.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select
          data-testid="filter-status"
          value={f.status}
          onChange={(e) => f.set({ status: e.target.value as StatusFilter })}
        >
          {STATUS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort by
        <select
          data-testid="filter-sort"
          value={f.sort}
          onChange={(e) => f.set({ sort: e.target.value as SortKey })}
        >
          {SORT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        Detector
        <select
          data-testid="filter-detector"
          value={f.det}
          onChange={(e) => f.set({ det: e.target.value })}
        >
          <option value="all">All detectors</option>
          {dets.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <p className="fnote">
        <kbd>J</kbd>
        <kbd>K</kbd> next or previous finding
      </p>
      <button
        className="btn freset"
        type="button"
        data-testid="filter-reset"
        onClick={() => f.reset()}
      >
        Reset filters
      </button>
    </Popover>
  );
}
