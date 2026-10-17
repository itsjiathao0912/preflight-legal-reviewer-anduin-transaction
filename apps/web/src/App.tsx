import { useEffect } from 'react';
import { AppShell } from './shell/AppShell';
import { appDb, purgeExpired } from './storage/db';
import { useSession } from './state/session';
import { useReview } from './state/review';
import { restoreLastDocument } from './state/last-doc';
import { loadManifest, scanPagesOf } from './features/open-document/samples';

let restoreStarted = false;

/** Reopen the last open document after a reload (expired uploads are purged first). */
async function restoreOnStart(): Promise<void> {
  if (restoreStarted) return;
  restoreStarted = true;
  const db = appDb();
  if (db) await purgeExpired(db).catch(() => undefined);
  await restoreLastDocument({
    db,
    fetchBytes: async (path) => {
      const res = await fetch(path);
      return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    },
    scanPages: async (sampleId) => {
      const entry = (await loadManifest()).find((s) => s.id === sampleId);
      const pages = entry ? scanPagesOf(entry) : [];
      return pages.length
        ? pages.map((p) => ({ n: p.n, url: `/samples/${p.file}`, sourceHash: p.sourceHash }))
        : null;
    },
    isEmpty: () => useReview.getState().phase === 'empty',
    open: (bytes, meta, opts) => useReview.getState().openDocument(bytes, meta, opts),
  });
}

export function App() {
  const refreshAllowance = useSession((s) => s.refreshAllowance);
  useEffect(() => {
    void restoreOnStart().catch(() => undefined);
    void refreshAllowance();
  }, [refreshAllowance]);
  return <AppShell />;
}
