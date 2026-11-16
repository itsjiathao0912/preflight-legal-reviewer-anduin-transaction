import { Icon } from '../../components/ui/icon';
import { activeProject, useProjects } from '../../state/projects';
import { isRail, useShell } from '../../state/shell';
import { ViewAsSwitch } from './ViewAsSwitch';
import { NotificationBell } from '../notifications/NotificationBell';

/** Up to two initials for the rail badge ("Fund IV review" -> "FI"). */
export function projectInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  ).slice(0, 2);
}

/**
 * Shell header block inside a project: back to Projects, project name, View as switch.
 * In the 56px icon rail it stays reachable as a compact column: an icon back button, a project
 * initials badge (full name in its title) and a narrow View as select.
 */
export function ProjectContext() {
  const project = useProjects(activeProject);
  const closeToList = useProjects((s) => s.closeToList);
  const rail = useShell(isRail);
  if (!project) return null;
  if (rail) {
    return (
      <div className="pj-ctx pj-ctx-rail" data-testid="project-context">
        <button
          type="button"
          className="ibtn pj-back"
          data-testid="back-to-projects"
          aria-label="All projects"
          title="All projects"
          onClick={closeToList}
        >
          <Icon name="chev" />
        </button>
        <span
          className="pj-ctx-badge"
          data-testid="project-context-name"
          title={project.name}
          aria-label={`Project: ${project.name}`}
          role="img"
        >
          {projectInitials(project.name)}
        </span>
        <ViewAsSwitch compact />
        <NotificationBell />
      </div>
    );
  }
  return (
    <div className="pj-ctx" data-testid="project-context">
      <button
        type="button"
        className="btn sm ghost pj-back"
        data-testid="back-to-projects"
        onClick={closeToList}
      >
        <Icon name="chev" />
        All projects
      </button>
      <span className="pj-ctx-name" data-testid="project-context-name" title={project.name}>
        {project.name}
      </span>
      <div className="pj-ctx-tools">
        <ViewAsSwitch />
        <NotificationBell />
      </div>
    </div>
  );
}
