import type { MemoryApi } from './memoryApi';
import { appDb } from '../storage/db';
import { apiEnabled, onApiBaseChange } from './base';
import { RealMemoryApi } from './realMemoryApi';
import { StubMemoryApi } from './stubMemoryApi';

/**
 * Memory API factory (Phase 08). `apiEnabled()` (API base not '') selects the real Worker client
 * (`realMemoryApi.ts`); otherwise the Dexie stub serves the preview build and the offline demo.
 * The selection is re-evaluated whenever the API base changes (e2e `setApiBase`): the cached client
 * is dropped and the next call builds the matching one. Both share the frozen `MemoryApi`.
 */
let api: MemoryApi | null = null;
let unsubscribe: (() => void) | null = null;

export function memoryApi(): MemoryApi | null {
  if (!unsubscribe) {
    unsubscribe = onApiBaseChange(() => {
      api = null;
    });
  }
  if (api) return api;
  const db = appDb();
  if (apiEnabled()) {
    api = new RealMemoryApi({ db });
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
