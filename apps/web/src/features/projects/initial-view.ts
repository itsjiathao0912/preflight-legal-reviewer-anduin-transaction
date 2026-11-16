import { IS_E2E } from '../../e2e-flag';
import type { ProjectsView } from '../../state/projects';

/**
 * First screen: the Projects page, except a counsel share tab or a pending share link (both keep
 * the shared-review flow) and the e2e build, which lands in the app shell unless a spec opts in.
 */
export function initialProjectsView(opts: { counsel: boolean; pendingToken: boolean }): {
  view: ProjectsView;
  projectsEnabled: boolean;
} {
  if (opts.counsel || opts.pendingToken) return { view: 'project', projectsEnabled: false };
  if (IS_E2E) {
    let optIn: boolean;
    try {
      optIn = localStorage.getItem('e2e.projects') === '1';
    } catch {
      optIn = false;
    }
    return { view: optIn ? 'projects' : 'project', projectsEnabled: optIn };
  }
  return { view: 'projects', projectsEnabled: true };
}
