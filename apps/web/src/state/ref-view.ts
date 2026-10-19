import { create } from 'zustand';
import { readPackageViewInWorker } from '../engine/client';
import type { BlockView } from '../engine/types';
import { readPackageMemberSource } from './package';
import { useShell } from './shell';

/**
 * Source File viewer: the reading pane temporarily shows one package reference file (read-only).
 * The sub doc stays the open document; Back returns to it at the scroll position it had.
 */
export type RefBlock = Pick<BlockView, 'id' | 'kind' | 'text' | 'section'>;

export interface RefTarget {
  docId: string;
  /** Short label ("LPA") and file name, shown in the bar. */
  label: string;
  name: string;
  /** Label of the sub doc for the Back button ("Subscription agreement"). */
  backLabel: string;
  /** Block index in the reference file to scroll to and flash (facts indexing). */
  blockIndex: number | null;
}

interface RefViewState {
  target: RefTarget | null;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  blocks: RefBlock[];
  /** Bumped on every open, so the pane re-scrolls and re-flashes the same target. */
  seq: number;
  open: (t: RefTarget) => Promise<void>;
  back: () => void;
}

/** Sub doc scroll offset saved by the reading pane (restored on Back). */
let savedScroll: number | null = null;
export function saveSubDocScroll(top: number): void {
  savedScroll = top;
}
export function takeSubDocScroll(): number | null {
  const v = savedScroll;
  savedScroll = null;
  return v;
}

const cache = new Map<string, RefBlock[]>();

export const useRefView = create<RefViewState>((set, get) => ({
  target: null,
  status: 'idle',
  blocks: [],
  seq: 0,
  open: async (t) => {
    useShell.getState().setRoute('findings');
    const seq = get().seq + 1;
    const hit = cache.get(t.docId);
    if (hit) {
      set({ target: t, status: 'ready', blocks: hit, seq });
      return;
    }
    set({ target: t, status: 'loading', blocks: [], seq });
    const src = await readPackageMemberSource(t.docId);
    let blocks: RefBlock[] | null = null;
    if (!('unavailable' in src) && src.format !== 'ocr' && src.format !== 'image') {
      const r = await readPackageViewInWorker({
        kind: src.format,
        bytes: src.bytes,
        name: src.name,
      });
      if (r.ok) blocks = r.blocks;
    }
    if (get().seq !== seq) return; // a newer open or Back won
    if (blocks) {
      cache.set(t.docId, blocks);
      set({ status: 'ready', blocks });
    } else set({ status: 'unavailable', blocks: [] });
  },
  back: () => set((s) => ({ target: null, status: 'idle', blocks: [], seq: s.seq + 1 })),
}));

/** Close the viewer without restoring anything (a new document was opened). */
export function resetRefView(): void {
  cache.clear();
  savedScroll = null;
  useRefView.getState().back();
}
