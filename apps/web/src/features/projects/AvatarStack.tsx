import { ROLE_LABEL, type ProjectMember } from '../../state/projects';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Member avatars with role (name + role only; emails are never rendered in the list). */
export function AvatarStack({ members, max = 4 }: { members: ProjectMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const more = members.length - shown.length;
  if (!members.length) return <span className="pj-dim">No members</span>;
  return (
    <ul className="pj-avatars" aria-label="Members" data-testid="project-members">
      {shown.map((m, i) => (
        <li key={`${m.name}-${i}`} className="pj-av" title={`${m.name} · ${ROLE_LABEL[m.role]}`}>
          <span aria-hidden="true">{initials(m.name) || '?'}</span>
          <span className="sr">
            {m.name}, {ROLE_LABEL[m.role]}
          </span>
        </li>
      ))}
      {more > 0 ? (
        <li className="pj-av pj-more" title={`${more} more`}>
          +{more}
        </li>
      ) : null}
    </ul>
  );
}
