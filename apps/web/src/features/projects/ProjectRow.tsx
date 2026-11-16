import { Icon } from '../../components/ui/icon';
import { gateStatusFor, lastActivityFor, openItemsFor, type Project } from '../../state/projects';
import { AvatarStack } from './AvatarStack';

const GATE_LABEL = { blocked: 'Blocked', ready: 'Ready', not_started: 'Not started' } as const;
const GATE_CLASS = { blocked: 'tag t-re', ready: 'tag t-ok', not_started: 'tag' } as const;

export function relativeTime(at: number, now: number = Date.now()): string {
  const m = Math.max(0, Math.round((now - at) / 60_000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function ProjectRow({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (id: string) => void;
}) {
  const gate = gateStatusFor(project);
  const open = openItemsFor(project);
  return (
    <li className="pj-row" data-testid="project-row" data-project-id={project.id}>
      <button type="button" className="pj-main" onClick={() => onOpen(project.id)}>
        <span className="pj-name" data-testid="project-name">
          {project.name}
        </span>
        {project.description ? (
          <span className="pj-desc" data-testid="project-description" title={project.description}>
            {project.description}
          </span>
        ) : null}
      </button>
      <span className={GATE_CLASS[gate]} data-testid="project-gate" data-gate={gate}>
        <Icon name={gate === 'blocked' ? 'lock' : gate === 'ready' ? 'unlock' : 'info'} />
        {GATE_LABEL[gate]}
      </span>
      <span className="pj-num" data-testid="project-open-items">
        {open} open
      </span>
      <span className="pj-dim" data-testid="project-activity">
        {relativeTime(lastActivityFor(project))}
      </span>
      <AvatarStack members={project.members} />
    </li>
  );
}
