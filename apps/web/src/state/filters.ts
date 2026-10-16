import { create } from 'zustand';
import { ISSUE_CLASSES_VIEW } from '../features/review/issue-classes';
import type { SevKey } from '../features/review/severity';
import { KEYS, safeGetJson, safeSet } from './storage';

export type StatusFilter = 'active' | 'open' | 'accepted' | 'counsel' | 'dismissed' | 'all';
export type SortKey = 'sev' | 'doc' | 'cls';

export interface Filters {
  sev: 'all' | SevKey;
  cls: string;
  status: StatusFilter;
  sort: SortKey;
  det: string;
}

export const DEFAULT_FILTERS: Filters = Object.freeze({
  sev: 'all',
  cls: 'all',
  status: 'active',
  sort: 'sev',
  det: 'all',
});

const STATUSES: StatusFilter[] = ['active', 'open', 'accepted', 'counsel', 'dismissed', 'all'];

/** Load ui:v1:filters, validating every field; anything unknown falls back to the default. */
export function loadFilters(): Filters {
  const raw = safeGetJson(KEYS.filters);
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FILTERS };
  const p = raw as Record<string, unknown>;
  const f: Filters = { ...DEFAULT_FILTERS };
  if (p.sev === 'block' || p.sev === 'fix' || p.sev === 'note' || p.sev === 'all') f.sev = p.sev;
  if (typeof p.status === 'string' && (STATUSES as string[]).includes(p.status))
    f.status = p.status as StatusFilter;
  if (p.sort === 'sev' || p.sort === 'doc' || p.sort === 'cls') f.sort = p.sort;
  if (typeof p.cls === 'string' && (p.cls === 'all' || ISSUE_CLASSES_VIEW.includes(p.cls)))
    f.cls = p.cls;
  if (typeof p.det === 'string' && p.det.length <= 120) f.det = p.det;
  return f;
}

interface FilterState extends Filters {
  set: (patch: Partial<Filters>) => void;
  reset: () => void;
}

export const useFilters = create<FilterState>((set, get) => {
  const save = () => {
    const { sev, cls, status, sort, det } = get();
    safeSet(KEYS.filters, JSON.stringify({ sev, cls, status, sort, det }));
  };
  return {
    ...loadFilters(),
    set: (patch) => {
      set(patch);
      save();
    },
    reset: () => {
      set({ ...DEFAULT_FILTERS });
      save();
    },
  };
});
