import { INTERPRETATION_MAX_CHARS, maskAndClamp } from '@aduin/core';
import { create } from 'zustand';
import { appDb } from '../../storage/db';
import { EMPTY_DRAFTS, type CounselDrafts } from './sheet-model';

/**
 * Counsel view state: per-document drafts (persisted in the Dexie `drafts` table as
 * `counsel:{docId}`, 24 h browser retention like other drafts), the AI draft state and the
 * question to open when the gate popover links into the sheet.
 */
export type AiDraftState = 'idle' | 'running' | 'unavailable';

interface CounselState {
  docId: string | null;
  drafts: CounselDrafts;
  aiState: AiDraftState;
  /** Question or prior item to open (gate popover link); `seq` re-triggers on the same id. */
  focus: { id: string; seq: number } | null;
  load: (docId: string | null) => Promise<void>;
  setEdit: (findingId: string, text: string | null) => void;
  setAiDrafts: (drafts: Record<string, string>, model: string | null) => void;
  setUseAi: (on: boolean) => void;
  setAiState: (s: AiDraftState) => void;
  focusItem: (id: string) => void;
}

const draftId = (docId: string) => `counsel:${docId}`;

function isDrafts(v: unknown): v is CounselDrafts {
  if (!v || typeof v !== 'object') return false;
  const d = v as CounselDrafts;
  return typeof d.edits === 'object' && typeof d.ai === 'object' && typeof d.useAi === 'boolean';
}

function strings(v: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(v)) if (typeof s === 'string' && s) out[k] = s;
  return out;
}

async function save(docId: string | null, drafts: CounselDrafts): Promise<void> {
  const db = appDb();
  if (!db || !docId) return;
  try {
    await db.drafts.put({ id: draftId(docId), createdAt: Date.now(), value: drafts });
  } catch {
    /* drafts stay in memory for this session */
  }
}

/** L6: every wording that reaches the sheet is masked and clamped to the sheet wording cap. */
export function cleanWording(text: string): string {
  return maskAndClamp(text.trim(), INTERPRETATION_MAX_CHARS);
}

let seq = 0;

export const useCounsel = create<CounselState>((set, get) => ({
  docId: null,
  drafts: EMPTY_DRAFTS,
  aiState: 'idle',
  focus: null,
  load: async (docId) => {
    if (get().docId === docId) return;
    set({ docId, drafts: EMPTY_DRAFTS, aiState: 'idle' });
    const db = appDb();
    if (!db || !docId) return;
    try {
      const v = (await db.drafts.get(draftId(docId)))?.value;
      if (get().docId !== docId || !isDrafts(v)) return;
      set({
        drafts: {
          edits: strings(v.edits as Record<string, unknown>),
          ai: strings(v.ai as Record<string, unknown>),
          aiModel: typeof v.aiModel === 'string' ? v.aiModel : null,
          useAi: v.useAi,
        },
      });
    } catch {
      /* no stored drafts */
    }
  },
  setEdit: (id, text) => {
    const edits = { ...get().drafts.edits };
    const clean = text === null ? '' : cleanWording(text);
    if (clean) edits[id] = clean;
    else delete edits[id];
    const drafts = { ...get().drafts, edits };
    set({ drafts });
    void save(get().docId, drafts);
  },
  setAiDrafts: (ai, model) => {
    const clean: Record<string, string> = {};
    for (const [k, t] of Object.entries(ai)) {
      const c = cleanWording(t);
      if (c) clean[k] = c;
    }
    const drafts = { ...get().drafts, ai: { ...get().drafts.ai, ...clean }, aiModel: model };
    set({ drafts });
    void save(get().docId, drafts);
  },
  setUseAi: (useAi) => {
    const drafts = { ...get().drafts, useAi };
    set({ drafts });
    void save(get().docId, drafts);
  },
  setAiState: (aiState) => set({ aiState }),
  focusItem: (id) => set({ focus: { id, seq: ++seq } }),
}));
