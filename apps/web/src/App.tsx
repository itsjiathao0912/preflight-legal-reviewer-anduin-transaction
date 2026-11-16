import { useEffect, useState } from 'react';
import { AppShell } from './shell/AppShell';
import { appDb, purgeExpired } from './storage/db';
import { useSession } from './state/session';
import { useReview } from './state/review';
import { restoreLastDocument, saveLastDoc } from './state/last-doc';
import { usePackage } from './state/package';
import { loadRecent, mergeRecent, saveRecent } from './state/recent-docs';
import { loadManifest, scanPagesOf } from './features/open-document/samples';
import { openSharedDocument } from './features/counsel/counsel-boot';
import { useShare } from './features/counsel/counsel-share';
import { isCounselMode } from './state/share-role';
import { WelcomeScreen } from './features/welcome/WelcomeScreen';
import { shouldShowWelcome } from './features/welcome/welcome-gate';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { buildSeedProjects } from './features/projects/seed';
import { enterProject } from './features/projects/enter-project';
import { initialProjectsView } from './features/projects/initial-view';
import { loadDemoPackages } from './features/open-document/demo-packages';
import { activeProject, useProjects } from './state/projects';

let restoreStarted = false;

/** Reopen the last open document after a reload (expired uploads are purged first). */
async function restoreOnStart(): Promise<void> {
  if (restoreStarted) return;
  restoreStarted = true;
  const db = appDb();
  if (db) await purgeExpired(db).catch(() => undefined);
  // read the stored switcher list before the restored open overwrites it
  const stored = await loadRecent(db).catch(() => []);
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
  }).catch(() => false);
  const recent = mergeRecent(useReview.getState().recent, stored);
  useReview.setState({ recent });
  void saveRecent(recent, db);
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

/** Projects v1: a document opened inside a project is remembered on that project. */
let projectDocWatchStarted = false;
function watchProjectDocs(): void {
  if (projectDocWatchStarted) return;
  projectDocWatchStarted = true;
  useReview.subscribe((s, prev) => {
    const id = s.doc?.id;
    if (!id || id === prev.doc?.id) return;
    if (useProjects.getState().view !== 'project') return;
    useProjects.getState().attachDoc(id);
  });
}

let startView: ReturnType<typeof initialProjectsView> | null = null;
function startViewOnce(): ReturnType<typeof initialProjectsView> {
  startView ??= initialProjectsView({
    counsel: isCounselMode(),
    pendingToken: !!useShare.getState().pendingToken,
  });
  return startView;
}

export function App() {
  const refreshAllowance = useSession((s) => s.refreshAllowance);
  const [projectsEnabled] = useState(() => {
    const v = startViewOnce();
    useProjects.getState().setView(v.view);
    return v.projectsEnabled;
  });
  const view = useProjects((s) => s.view);
  const activeId = useProjects((s) => s.activeProjectId);
  const [entered, setEntered] = useState<string | null>(null);
  useEffect(() => {
    if (!projectsEnabled || view !== 'project' || !activeId || activeId === entered) return;
    setEntered(activeId);
    const p = activeProject(useProjects.getState());
    if (p) void enterProject(p, restoreOnStart).catch(() => undefined);
  }, [projectsEnabled, view, activeId, entered]);
  useEffect(() => {
    // counsel share link: a counsel tab opens only the shared document and calls no analyst API;
    // a pending link skips the analyst restore (the join opens the shared document)
    if (isCounselMode()) {
      const ref = useShare.getState().docRef;
      if (ref) void openSharedDocument(ref);
      return;
    }
    if (useShare.getState().pendingToken) return;
    watchPackageAttach();
    // the Projects page comes first: the last-doc restore waits until a project is entered
    if (projectsEnabled) {
      watchProjectDocs();
      void useProjects
        .getState()
        .load(async () => buildSeedProjects(await loadDemoPackages()))
        .then(() => {
          // a reload inside a project returns to it (falls back to the list when it is gone)
          if (useProjects.getState().view === 'projects') useProjects.getState().restoreActive();
        })
        .catch(() => undefined);
    } else {
      void restoreOnStart().catch(() => undefined);
    }
    void refreshAllowance();
  }, [refreshAllowance, projectsEnabled]);
  const [welcome, setWelcome] = useState(() => shouldShowWelcome());
  if (projectsEnabled && view === 'projects') {
    return (
      <>
        <ProjectsPage onOpen={(id) => useProjects.getState().open(id)} />
        {welcome && <WelcomeScreen onEnter={() => setWelcome(false)} />}
      </>
    );
  }
  return (
    <>
      <AppShell />
      {welcome && <WelcomeScreen onEnter={() => setWelcome(false)} />}
    </>
  );
}
