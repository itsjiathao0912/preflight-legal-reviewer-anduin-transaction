import { create } from 'zustand';
import { KEYS, safeGet, safeSet } from './storage';

export const ROUTES = [
  'findings',
  'counsel',
  'structure',
  'compare',
  'memory',
  'documents',
] as const;
export type Route = (typeof ROUTES)[number];

export function isRoute(x: string): x is Route {
  return (ROUTES as readonly string[]).includes(x);
}

/**
 * Shell state: route (never persisted; the app always lands on Findings), sidebar collapse
 * (persisted as ui:v1:sidebar, the only persisted shell state) and the auto-rail flag (max-width:1199px).
 */
/** One-shot hint for the Structure screen (e.g. Findings "See in Structure"); not persisted. */
export type StructureFocus = { tab: 'terms'; key?: string };

/** The three views of the Findings right panel (Document map folded into Findings). */
export type FindingsView = 'issues' | 'flow' | 'sources';

interface ShellState {
  route: Route;
  collapsed: boolean;
  narrow: boolean;
  /** "Open a document" dialog (not persisted). */
  openDoc: boolean;
  setOpenDoc: (o: boolean) => void;
  setRoute: (r: Route) => void;
  toggleCollapsed: () => void;
  structureFocus: StructureFocus | null;
  /** Findings right panel view (not persisted). */
  findingsView: FindingsView;
  setFindingsView: (v: FindingsView) => void;
  setStructureFocus: (f: StructureFocus | null) => void;
  clearStructureFocus: () => void;
  setNarrow: (n: boolean) => void;
}

export const useShell = create<ShellState>((set, get) => ({
  route: 'findings',
  collapsed: safeGet(KEYS.sidebar) === '1',
  narrow: false,
  openDoc: false,
  setOpenDoc: (openDoc) => set({ openDoc }),
  // the old Document map route lands on Findings: Sources for a term focus, Form flow otherwise
  setRoute: (route) =>
    route === 'structure'
      ? set((s) => ({
          route: 'findings',
          findingsView: s.structureFocus?.tab === 'terms' ? 'sources' : 'flow',
        }))
      : set({ route }),
  structureFocus: null,
  findingsView: 'issues',
  setFindingsView: (findingsView) => set({ findingsView }),
  setStructureFocus: (structureFocus) => set({ structureFocus }),
  clearStructureFocus: () => set({ structureFocus: null }),
  toggleCollapsed: () => {
    const collapsed = !get().collapsed;
    safeSet(KEYS.sidebar, collapsed ? '1' : '0');
    set({ collapsed });
  },
  setNarrow: (narrow) => set({ narrow }),
}));

export const isRail = (s: Pick<ShellState, 'collapsed' | 'narrow'>) => s.collapsed || s.narrow;

/** Media query that forces the icon rail (app.html matchMedia('(max-width:1199px)')). */
export const RAIL_QUERY = '(max-width:1199px)';
