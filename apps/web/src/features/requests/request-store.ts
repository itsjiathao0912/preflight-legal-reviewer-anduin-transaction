import type { Owner } from '@aduin/core';
import { create } from 'zustand';
import { safeGetJson, safeSet } from '../../state/storage';
import type { RequestMeta } from './request-model';

/**
 * Request drawer state (22-10-26): which owner tab is open (not persisted), the question to bring
 * into view, and the browser-only request fields per document/package + owner, stored in
 * localStorage as `requests:v1:<docKey>`. Nothing reaches memory or the server.
 */
export type RequestMetaMap = Partial<Record<Owner, RequestMeta>>;

export const storeKey = (docKey: string) => `requests:v1:${docKey}`;

function clean(v: unknown): RequestMetaMap {
  const out: RequestMetaMap = {};
  if (!v || typeof v !== 'object') return out;
  for (const o of ['counsel', 'gp', 'fund_admin'] as const) {
    const m = (v as Record<string, unknown>)[o];
    if (!m || typeof m !== 'object') continue;
    const r = m as Record<string, unknown>;
    const meta: RequestMeta = {};
    if (typeof r.to === 'string') meta.to = r.to.slice(0, 200);
    if (typeof r.neededBy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.neededBy))
      meta.neededBy = r.neededBy;
    if (typeof r.sentAt === 'number' && Number.isFinite(r.sentAt)) meta.sentAt = r.sentAt;
    out[o] = meta;
  }
  return out;
}

interface RequestState {
  /** Owner tab of the open drawer; null = closed. */
  open: Owner | null;
  /** Question key to open and bring into view; `seq` re-triggers on the same key. */
  focus: { key: string; seq: number } | null;
  docKey: string | null;
  meta: RequestMetaMap;
  openDrawer: (owner: Owner, focusKey?: string) => void;
  close: () => void;
  load: (docKey: string | null) => void;
  setMeta: (owner: Owner, patch: Partial<RequestMeta>) => void;
  /** Sets Sent once (an earlier send date is kept). */
  markSent: (owner: Owner, at?: number) => void;
}

let seq = 0;

export const useRequests = create<RequestState>((set, get) => ({
  open: null,
  focus: null,
  docKey: null,
  meta: {},
  openDrawer: (open, focusKey) =>
    set({ open, focus: focusKey ? { key: focusKey, seq: ++seq } : null }),
  close: () => set({ open: null, focus: null }),
  load: (docKey) => {
    if (get().docKey === docKey) return;
    set({ docKey, meta: docKey ? clean(safeGetJson(storeKey(docKey))) : {} });
  },
  setMeta: (owner, patch) => {
    const meta = { ...get().meta, [owner]: { ...get().meta[owner], ...patch } };
    set({ meta });
    const k = get().docKey;
    if (k) safeSet(storeKey(k), JSON.stringify(meta));
  },
  markSent: (owner, at = Date.now()) => {
    if (get().meta[owner]?.sentAt) return;
    get().setMeta(owner, { sentAt: at });
  },
}));
