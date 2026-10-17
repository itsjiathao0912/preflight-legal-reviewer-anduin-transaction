import type { AuditEvent } from '@aduin/core';

/**
 * Audit trail list (append-only, read-only). Presentational: no fetching inside; the caller pages
 * through `memoryApi().audit(cursor)` and passes the events (Phase 08b mounts it as a tab).
 */
const ACTION_TEXT: Record<string, string> = {
  session_created: 'Session started',
  decision_recorded: 'Decision recorded',
  decision_revoked: 'Decision reopened',
  answer_recorded: 'Counsel answer recorded',
  rule_added: 'Rule created',
  rule_proposed: 'Rule proposed',
  rule_approved: 'Rule approved',
  rule_rejected: 'Rule rejected',
  rule_revoked: 'Rule deactivated',
  counsel_sheet_exported: 'Query sheet exported',
};

export function actionText(action: string): string {
  return ACTION_TEXT[action] ?? action.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function when(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditList({
  events,
  loading = false,
  onMore,
}: {
  events: readonly AuditEvent[];
  loading?: boolean;
  onMore?: () => void;
}) {
  return (
    <div className="audit" data-testid="audit-list">
      {events.length ? (
        <ul className="ev">
          {events.map((e) => (
            <li key={e.id} data-testid="audit-event" data-action={e.action}>
              <span className="l1">
                <span>{when(e.at)}</span>
                <span>{e.actor_name}</span>
                {e.entity_type ? <span>{e.entity_type}</span> : null}
              </span>
              <span>
                {actionText(e.action)}
                {e.reason ? ` · ${e.reason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : loading ? null : (
        <p className="empty" data-testid="audit-empty">
          No audit entries yet.
        </p>
      )}
      {loading ? (
        <p className="hint" role="status">
          Loading the audit trail…
        </p>
      ) : null}
      {onMore && !loading ? (
        <button type="button" className="btn sm" data-testid="audit-more" onClick={onMore}>
          Show older entries
        </button>
      ) : null}
    </div>
  );
}
