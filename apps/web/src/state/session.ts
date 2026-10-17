import { create } from 'zustand';
import { limits } from '@aduin/core';
import { fetchQuota } from '../api/quota';
import { allowanceLeft, appDb } from '../storage/db';
import { KEYS, safeGet, safeSet } from './storage';

/**
 * Default analyst name (approved mockup name). Phase 08: the shown name is the stored session name
 * (Dexie uiState `session:analystName`), edited inline on the sidebar badge; it feeds
 * `bootstrap(name)` and `decided_by_name`. The default is kept until the analyst changes it.
 */
export const DEFAULT_ANALYST_NAME = 'Linh Tran';
export const ANALYST_NAME_MAX = 80;

/**
 * Trimmed analyst name, or null when it is not 1-80 characters. Control, format (incl. bidi
 * overrides), unassigned and private-use characters (`\p{C}`) are stripped first (review fix F6).
 * Note: renaming only changes the local badge and the next bootstrap; a live sandbox session keeps
 * the server-side analyst it was created with.
 */
export function cleanAnalystName(name: string): string | null {
  const n =
    typeof name === 'string' ? name.replace(/\p{C}/gu, ' ').trim().replace(/\s+/g, ' ') : '';
  return n.length >= 1 && n.length <= ANALYST_NAME_MAX ? n : null;
}

interface SessionState {
  /** Analyst display name (session name; default `Linh Tran`). */
  analystName: string;
  /**
   * Read-only demo session (from the POST /api/session response `read_only`, never the cookie).
   * True disables memory writes up front; the outbox is skipped.
   */
  readOnly: boolean;
  setAnalystName: (name: string) => void;
  setReadOnly: (readOnly: boolean) => void;
  /** AI switch (persisted as ui:v1:ai, AC38). Effect wired in P05. */
  aiOn: boolean;
  /** Privacy notice accepted in this session (never persisted). */
  privacyAck: boolean;
  /** Fresh-AI documents left today (display-only stub). */
  allowance: number;
  /**
   * Real allowance from GET /api/quota (Phase 05). null = not available (API base '' or the fetch
   * failed): the stub `allowance` above is shown instead, silently (G14).
   */
  quota: { left: number; limit: number; resetsAt: number; globalOk: boolean } | null;
  /** Privacy notice requested before switching AI on. */
  privacyPrompt: boolean;
  setAi: (on: boolean) => void;
  requestAiOn: () => void;
  ackPrivacy: () => void;
  closePrivacyPrompt: () => void;
  refreshAllowance: () => Promise<void>;
  /** Refetch /api/quota (no-op when the API base is ''; failures keep the stub). */
  refreshQuota: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  analystName: DEFAULT_ANALYST_NAME,
  readOnly: false,
  setAnalystName: (name) => {
    const n = cleanAnalystName(name);
    if (n) set({ analystName: n });
  },
  setReadOnly: (readOnly) => set({ readOnly }),
  aiOn: safeGet(KEYS.ai) !== 'off',
  privacyAck: false,
  allowance: limits.visitorAiDocsPerDay,
  quota: null,
  privacyPrompt: false,
  setAi: (aiOn) => {
    safeSet(KEYS.ai, aiOn ? 'on' : 'off');
    set({ aiOn });
  },
  requestAiOn: () => {
    if (get().aiOn) return;
    if (get().privacyAck) get().setAi(true);
    else set({ privacyPrompt: true });
  },
  ackPrivacy: () => set({ privacyAck: true }),
  closePrivacyPrompt: () => set({ privacyPrompt: false }),
  refreshAllowance: async () => {
    const db = appDb();
    if (!db) return;
    try {
      set({ allowance: await allowanceLeft(db) });
    } catch {
      /* keep the default */
    }
  },
  refreshQuota: async () => {
    const q = await fetchQuota();
    if (!q) return;
    set({
      quota: {
        left: Math.max(0, q.ai.limit - q.ai.used),
        limit: q.ai.limit,
        resetsAt: q.ai.resetsAt,
        globalOk: q.globalOk,
      },
    });
  },
}));
