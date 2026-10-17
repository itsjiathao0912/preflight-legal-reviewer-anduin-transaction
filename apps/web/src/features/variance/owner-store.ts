import { create } from 'zustand';
import { appDb } from '../../storage/db';
import { isOwnerChoice, type OwnerChoice } from './owner-groups';

/**
 * Variance Phase 04 (B1): analyst owner overrides per document, persisted in `uiState` under
 * `variance:owner:{docId}` (finding id -> choice). No Dexie version bump. The override is recorded
 * on the wire as `owner_source: 'override'` when the question is created.
 */
export const OWNER_KEY = (docId: string) => `variance:owner:${docId}`;

interface OwnerState {
  docId: string | null;
  choices: Record<string, OwnerChoice>;
  load: (docId: string | null) => Promise<void>;
  /** Set (or clear with `null`) the override for one finding of the loaded document. */
  setChoice: (findingId: string, choice: OwnerChoice | null) => Promise<void>;
}

function clean(v: unknown): Record<string, OwnerChoice> {
  const out: Record<string, OwnerChoice> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, c] of Object.entries(v as Record<string, unknown>))
    if (isOwnerChoice(c)) out[k] = c;
  return out;
}

export async function readOwnerChoices(docId: string): Promise<Record<string, OwnerChoice>> {
  const db = appDb();
  if (!db) return {};
  try {
    return clean((await db.uiState.get(OWNER_KEY(docId)))?.value);
  } catch {
    return {};
  }
}

export const useOwners = create<OwnerState>((set, get) => ({
  docId: null,
  choices: {},
  load: async (docId) => {
    if (get().docId === docId) return;
    set({ docId, choices: {} });
    if (!docId) return;
    const choices = await readOwnerChoices(docId);
    if (get().docId === docId) set({ choices });
  },
  setChoice: async (findingId, choice) => {
    const docId = get().docId;
    if (!docId) return;
    const choices = { ...get().choices };
    if (choice === null) delete choices[findingId];
    else choices[findingId] = choice;
    set({ choices });
    const db = appDb();
    if (!db) return;
    try {
      await db.uiState.put({ key: OWNER_KEY(docId), value: choices, updatedAt: Date.now() });
    } catch {
      /* storage unavailable: the override stays for this session */
    }
  },
}));
