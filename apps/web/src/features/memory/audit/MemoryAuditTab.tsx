import type { AuditEvent } from '@aduin/core';
import { useMemo, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { AuditList } from '../../audit/AuditList';
import { auditForDisplay, filterAudit, type AuditFilter } from '../memory-join';

const GROUPS: readonly (readonly [AuditFilter, string])[] = [
  ['all', 'All actions'],
  ['decision', 'Decisions'],
  ['reopen', 'Reopened decisions'],
  ['rule', 'Rules'],
];

/**
 * Audit trail tab (AC55 filters): the page owns fetching and keyset paging; the presentational
 * Phase 08 `AuditList` renders the firm's events filtered by action group (X11 display form).
 */
export function MemoryAuditTab({
  events,
  firmId,
  hasMore,
  loading,
  onMore,
}: {
  events: readonly AuditEvent[];
  firmId: string;
  hasMore: boolean;
  loading: boolean;
  onMore: () => void;
}) {
  const [group, setGroup] = useState<AuditFilter>('all');
  const firmEvents = useMemo(() => filterAudit(events, 'all', firmId), [events, firmId]);
  const list = useMemo(
    () => filterAudit(events, group, firmId).map(auditForDisplay),
    [events, group, firmId],
  );
  return (
    <div data-testid="memory-audit">
      <div className="lockbar">
        <Icon name="lock" />
        <span>
          <b>Entries cannot be edited or removed.</b> Append-only log: new actions add an entry, old
          ones never change.
        </span>
      </div>
      <div className="mtool">
        <label className="sr" htmlFor="mem-fAud">
          Filter audit entries
        </label>
        <select
          id="mem-fAud"
          data-testid="memory-audit-group"
          value={group}
          onChange={(e) => setGroup(e.target.value as AuditFilter)}
        >
          {GROUPS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="shown" role="status" aria-live="polite" data-testid="memory-audit-shown">
          {list.length} of {firmEvents.length} entries, newest first
        </span>
      </div>
      <AuditList events={list} loading={loading} {...(hasMore ? { onMore } : {})} />
      <p className="mut" data-testid="memory-audit-note">
        Filters apply to the loaded entries only{hasMore ? '; load older entries to see more' : ''}.
      </p>
    </div>
  );
}
