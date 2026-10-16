import type { MemoryApi } from './memoryApi';
import { appDb } from '../storage/db';
import { StubMemoryApi } from './stubMemoryApi';

/**
 * Memory API factory. Phase 03 ships only the Dexie-backed stub; Phase 04b/08 add the fetch client
 * for the Worker `/api/memory/*` routes behind this same interface.
 */
let api: MemoryApi | null = null;
export function memoryApi(): MemoryApi | null {
  if (api) return api;
  const db = appDb();
  if (!db) return null;
  api = new StubMemoryApi(db);
  return api;
}
