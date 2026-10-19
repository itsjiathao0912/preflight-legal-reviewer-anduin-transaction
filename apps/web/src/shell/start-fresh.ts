import { clientHeaders } from '../api/http';
import { appDb } from '../storage/db';

export interface StartFreshDeps {
  fetch: typeof fetch;
  deleteDb: () => Promise<void>;
  storages: () => Storage[];
  reload: () => void;
}

const defaultDeps = (): StartFreshDeps => ({
  fetch: (...a) => fetch(...a),
  deleteDb: async () => {
    const db = appDb();
    if (db) await db.delete();
  },
  storages: () => [window.localStorage, window.sessionStorage],
  reload: () => window.location.replace('/'),
});

/**
 * "Start fresh": ask the Worker to clear the HttpOnly session cookies, then delete this browser's
 * IndexedDB (documents, triage, drafts, outbox), clear local/session storage, and reload. Every
 * step is best effort: a failed reset call still clears local data and reloads (the cookie stays,
 * so the same sandbox comes back).
 */
export async function startFresh(deps: StartFreshDeps = defaultDeps()): Promise<void> {
  try {
    await deps.fetch('/api/session/reset', {
      method: 'POST',
      credentials: 'same-origin',
      headers: clientHeaders({ 'content-type': 'application/json' }),
      body: '{}',
    });
  } catch {
    /* proceed: local data is still cleared */
  }
  try {
    await deps.deleteDb();
  } catch {
    /* proceed */
  }
  for (const s of (() => {
    try {
      return deps.storages();
    } catch {
      return [];
    }
  })()) {
    try {
      s.clear();
    } catch {
      /* ignore */
    }
  }
  deps.reload();
}
