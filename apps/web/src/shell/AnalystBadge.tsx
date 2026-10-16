import { ANALYST_NAME } from '../state/session';
import { isRail, useShell } from '../state/shell';

export function AnalystBadge() {
  const rail = useShell(isRail);
  const initials = ANALYST_NAME.split(' ')
    .map((p) => p[0])
    .join('');
  return (
    <div className="me" title={rail ? ANALYST_NAME : undefined}>
      <span className="av" aria-hidden="true">
        {initials}
      </span>
      <span className="nm" data-testid="analyst-name">
        {ANALYST_NAME}
      </span>
      <span className="sr">Signed in as {ANALYST_NAME}, digitization analyst</span>
    </div>
  );
}
