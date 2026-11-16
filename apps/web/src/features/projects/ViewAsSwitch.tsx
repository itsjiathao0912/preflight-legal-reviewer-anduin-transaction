import { useId } from 'react';
import { ROLE_LABEL, ROLES, useProjects, type Role } from '../../state/projects';

/** Advisory "View as <role>" switch (client-only, no login). */
export function ViewAsSwitch({ compact = false }: { compact?: boolean }) {
  const viewAs = useProjects((s) => s.viewAs);
  const setViewAs = useProjects((s) => s.setViewAs);
  const id = useId();
  return (
    <label className={compact ? 'pj-viewas compact' : 'pj-viewas'} htmlFor={id}>
      <span className={compact ? 'pj-sr' : undefined}>View as</span>
      <select
        id={id}
        data-testid="view-as"
        title={compact ? `View as ${ROLE_LABEL[viewAs]}` : undefined}
        value={viewAs}
        onChange={(e) => setViewAs(e.target.value as Role)}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </label>
  );
}
