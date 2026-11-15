import type { Owner } from '@aduin/core';
import { create } from 'zustand';
import { safeGetJson, safeSet } from '../../state/storage';
import { roundOf, type ExtraQuestion, type RequestMeta } from './request-model';

/**
 * Request drawer state (22-10-26): which owner tab is open (not persisted), the question to bring
 * into view, and the browser-only request fields per document/package + owner, stored in
 * localStorage as `requests:v1:<docKey>`. Nothing reaches memory or the server.
 */
export type RequestMetaMap = Partial<Record<Owner, RequestMeta>>;

export const storeKey = (docKey: string) => `requests:v1:${docKey}`;

export const MAX_EXTRA = 50;

export function clean(v: unknown): RequestMetaMap {
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
    const int = (x: unknown, max: number) =>
      typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= max ? x : undefined;
    const round = int(r.round, 99);
    if (round !== undefined) meta.round = round;
    const sentCount = int(r.sentCount, 9999);
    if (sentCount !== undefined) meta.sentCount = sentCount;
    if (r.asked && typeof r.asked === 'object') {
      const asked: Record<string, number> = {};
      for (const [k, n] of Object.entries(r.asked as Record<string, unknown>).slice(0, 500)) {
        const v = int(n, 99);
        if (v && k.length <= 300) asked[k] = v;
      }
      meta.asked = asked;
    }
    if (Array.isArray(r.extra)) {
      const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
      meta.extra = r.extra
        .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
        .map((e) => ({
          id: str(e.id, 40),
          where: str(e.where, 200),
          quote: str(e.quote, 2000),
          question: str(e.question, 2000),
          at: typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : 0,
        }))
        .filter((e) => e.id && e.question.trim())
        .slice(0, MAX_EXTRA);
    }
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
  /**
   * Sends a round: when never sent, or when questions were added since the last send, the round
   * goes up, Sent moves to `at`, and each open question key counts one more ask. Otherwise no-op.
   */
  markSent: (owner: Owner, total?: number, openKeys?: readonly string[], at?: number) => void;
  addExtra: (owner: Owner, q: Omit<ExtraQuestion, 'id' | 'at'>) => void;
  removeExtra: (owner: Owner, id: string) => void;
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
  markSent: (owner, total = 0, openKeys = [], at = Date.now()) => {
    const m = get().meta[owner];
    const round = roundOf(m);
    const count = total + (m?.extra?.length ?? 0);
    if (round > 0 && count <= (m?.sentCount ?? count)) return;
    const asked = { ...m?.asked };
    for (const k of openKeys) asked[k] = Math.min(99, (asked[k] ?? 0) + 1);
    get().setMeta(owner, { sentAt: at, round: Math.min(99, round + 1), sentCount: count, asked });
  },
  addExtra: (owner, q) => {
    const extra = get().meta[owner]?.extra ?? [];
    if (extra.length >= MAX_EXTRA || !q.question.trim()) return;
    const item: ExtraQuestion = {
      id: `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      where: q.where.trim().slice(0, 200),
      quote: q.quote.trim().slice(0, 2000),
      question: q.question.trim().slice(0, 2000),
      at: Date.now(),
    };
    get().setMeta(owner, { extra: [...extra, item] });
  },
  removeExtra: (owner, id) => {
    const extra = (get().meta[owner]?.extra ?? []).filter((e) => e.id !== id);
    get().setMeta(owner, { extra });
  },
}));
