import type { MemoryApi } from './memoryApi';
import { IS_E2E } from '../e2e-flag';
import { e2eRealMemory } from '../e2e-hook';
import { hasTurnstileProvider, onUserIntent, turnstileToken } from '../features/ai/turnstile';
import { appDb } from '../storage/db';
import { isCounselMode } from '../state/share-role';
import { apiEnabled, onApiBaseChange } from './base';
import { RealMemoryApi } from './realMemoryApi';
import { StubMemoryApi } from './stubMemoryApi';

/**
 * Memory API factory (Phase 08). `apiEnabled()` (API base not '') selects the real Worker client
 * (`realMemoryApi.ts`); otherwise the Dexie stub serves the preview build and the offline demo.
 * The selection is re-evaluated whenever the API base changes (e2e `setApiBase`): the cached client
 * is dropped and the next call builds the matching one. Both share the frozen `MemoryApi`.
 * Phase 08 S2: the Playwright preview build (`--mode e2e`) has no Worker memory, so it keeps the
 * stub even when an AI spec switches the API base on for `/api/ai` (the `stack-memory` project
 * runs the plain build against the real Worker).
 * Phase 08b: a preview spec may opt into the real client (`__aduinE2E.useRealMemory(true)`, IS_E2E
 * only) and answer every /api/** call with a page.route fake Worker; the cached client is rebuilt
 * when the wanted kind changes.
 */
let api: MemoryApi | null = null;
let unsubscribe: (() => void) | null = null;
// an explicit user action re-arms the session bootstrap after a cached verification failure
onUserIntent(() => {
  if (api instanceof RealMemoryApi) api.clearBootFailure();
});

export function memoryApi(): MemoryApi | null {
  // counsel share link: counsel holds only the counsel cookie; no memory client exists in that tab
  if (isCounselMode()) return null;
  if (!unsubscribe) {
    unsubscribe = onApiBaseChange(() => {
      api = null;
    });
  }
  const wantReal = apiEnabled() && (!IS_E2E || e2eRealMemory());
  if (api && api instanceof RealMemoryApi === wantReal) return api;
  api = null;
  const db = appDb();
  if (wantReal) {
    api = new RealMemoryApi({ db, turnstileToken, turnstileRequired: hasTurnstileProvider });
    return api;
  }
  if (!db) return null;
  api = new StubMemoryApi(db);
  return api;
}

/** True when the current client is the real Worker client (for read-only and outbox wiring). */
export function isRealMemoryApi(a: MemoryApi | null): a is RealMemoryApi {
  return a instanceof RealMemoryApi;
}
