import { useFilters } from '../../state/filters';
import type { AppNotification } from '../../state/notifications';
import { useProjects } from '../../state/projects';
import { useReview } from '../../state/review';
import { useShell } from '../../state/shell';

/**
 * Notifications v1: a row click opens its project at the right screen. Entering another project
 * runs the normal open flow first (demo package dialog), so the route is applied once that
 * project's document is ready.
 */
let pending: {
  projectId: string;
  target: AppNotification['target'];
  fromDoc: string | null;
} | null = null;
let watching = false;

function applyTarget(target: AppNotification['target']): void {
  if (target === 'findings_changes') {
    useFilters.getState().set({ kind: 'changes' });
    useShell.getState().setRoute('findings');
  } else {
    useShell.getState().setRoute('counsel');
  }
}

function watch(): void {
  if (watching) return;
  watching = true;
  useReview.subscribe((s) => {
    if (!pending) return;
    if (useProjects.getState().activeProjectId !== pending.projectId) {
      pending = null;
      return;
    }
    if (!s.doc || s.phase !== 'ready' || s.doc.id === pending.fromDoc) return;
    const t = pending.target;
    pending = null;
    applyTarget(t);
  });
}

export function openNotificationTarget(n: AppNotification): void {
  const ps = useProjects.getState();
  if (!ps.projects.some((p) => p.id === n.projectId)) return;
  const same = ps.activeProjectId === n.projectId;
  pending = null;
  ps.open(n.projectId);
  if (same) {
    applyTarget(n.target);
    return;
  }
  pending = {
    projectId: n.projectId,
    target: n.target,
    fromDoc: useReview.getState().doc?.id ?? null,
  };
  watch();
}
