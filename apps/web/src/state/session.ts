import { create } from 'zustand';
import { limits } from '@aduin/core';
import { allowanceLeft, appDb } from '../storage/db';
import { KEYS, safeGet, safeSet } from './storage';

/** Analyst name: placeholder constant until sign-in exists (app_NOTES open question 4). */
export const ANALYST_NAME = 'Linh Tran';

interface SessionState {
  /** AI switch (persisted as ui:v1:ai, AC38). Effect wired in P05. */
  aiOn: boolean;
  /** Privacy notice accepted in this session (never persisted). */
  privacyAck: boolean;
  /** Fresh-AI documents left today (display-only stub). */
  allowance: number;
  /** Privacy notice requested before switching AI on. */
  privacyPrompt: boolean;
  setAi: (on: boolean) => void;
  requestAiOn: () => void;
  ackPrivacy: () => void;
  closePrivacyPrompt: () => void;
  refreshAllowance: () => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  aiOn: safeGet(KEYS.ai) !== 'off',
  privacyAck: false,
  allowance: limits.visitorAiDocsPerDay,
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
}));
