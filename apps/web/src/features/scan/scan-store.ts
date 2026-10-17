import { create } from 'zustand';
import type { OcrPageState } from '../../engine/types';

/**
 * Scan viewer state (Phase 06e): page image URLs and live per-page OCR progress for the open
 * scanned document. Object URLs this store created (uploads, rendered PDF pages) are revoked when
 * the next document opens or the store is cleared, so 30 page blobs never outlive their document.
 * Static sample URLs (`/samples/...`) are not owned and never revoked.
 */
export interface ScanProgressPage {
  index: number;
  state: OcrPageState;
  reason?: string;
}

interface ScanState {
  /** Bumped on every begin/clear so late async work for an older document is ignored. */
  seq: number;
  pageCount: number;
  /** 0-based page index -> image URL. */
  urls: Record<number, string>;
  progress: ScanProgressPage[];
  /** 0-based page shown in the viewer. */
  page: number;
  begin: (pageCount: number, urls?: Record<number, string>) => number;
  setUrl: (seq: number, index: number, url: string, owned: boolean) => void;
  setProgress: (seq: number, pages: readonly ScanProgressPage[]) => void;
  setPage: (page: number) => void;
  clear: () => void;
}

const owned = new Set<string>();

function revokeOwned(): void {
  for (const u of owned) URL.revokeObjectURL(u);
  owned.clear();
}

export const useScan = create<ScanState>((set, get) => ({
  seq: 0,
  pageCount: 0,
  urls: {},
  progress: [],
  page: 0,
  begin: (pageCount, urls = {}) => {
    revokeOwned();
    const seq = get().seq + 1;
    const n = Math.max(0, Math.min(Math.floor(pageCount), 1000));
    set({
      seq,
      pageCount: n,
      urls: { ...urls },
      progress: Array.from({ length: n }, (_, index) => ({ index, state: 'queued' as const })),
      page: 0,
    });
    return seq;
  },
  setUrl: (seq, index, url, own) => {
    if (seq !== get().seq) {
      if (own) URL.revokeObjectURL(url);
      return;
    }
    if (own) owned.add(url);
    set({ urls: { ...get().urls, [index]: url } });
  },
  setProgress: (seq, pages) => {
    if (seq !== get().seq) return;
    const next = [...get().progress];
    for (const p of pages) {
      const i = next.findIndex((x) => x.index === p.index);
      const v: ScanProgressPage = { index: p.index, state: p.state };
      if (p.reason) v.reason = p.reason;
      if (i >= 0) next[i] = v;
    }
    set({ progress: next });
  },
  setPage: (page) => {
    const n = get().pageCount;
    if (n === 0) return;
    set({ page: Math.max(0, Math.min(n - 1, page)) });
  },
  clear: () => {
    revokeOwned();
    set({ seq: get().seq + 1, pageCount: 0, urls: {}, progress: [], page: 0 });
  },
}));

/** Number of owned object URLs currently alive (memory-growth checks in tests). */
export function ownedUrlCount(): number {
  return owned.size;
}
