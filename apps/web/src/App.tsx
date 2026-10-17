import { useEffect } from 'react';
import { AppShell } from './shell/AppShell';
import { appDb, purgeExpired } from './storage/db';
import { useSession } from './state/session';
import { useReview } from './state/review';
import { restoreLastDocument, saveLastDoc } from './state/last-doc';
import { usePackage } from './state/package';
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
    restorePackage: (id) => usePackage.getState().restore(id),
  });
}

/**
 * Intake R2: a one-document package is attached after its open, so its last-doc row was saved
 * without the package id. Re-save the row when the open document gains a package id.
 */
let lastDocWatchStarted = false;
function watchPackageAttach(): void {
  if (lastDocWatchStarted) return;
  lastDocWatchStarted = true;
  useReview.subscribe((s, prev) => {
    const doc = s.doc;
    if (!doc?.packageId || doc.packageId === prev.doc?.packageId) return;
    if (prev.doc && prev.doc.id !== doc.id) return; // a new open saves its own row
    const { id: _id, ...meta } = doc;
    void saveLastDoc(meta);
  });
}

export function App() {
  const refreshAllowance = useSession((s) => s.refreshAllowance);
  useEffect(() => {
    watchPackageAttach();
    void restoreOnStart().catch(() => undefined);
    void refreshAllowance();
  }, [refreshAllowance]);
  return <AppShell />;
}
