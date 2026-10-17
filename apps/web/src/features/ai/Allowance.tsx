import { limits } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { useSession } from '../../state/session';

/**
 * Fresh-AI allowance line. Real numbers come from GET /api/quota when the API base is set and the
 * fetch succeeded; otherwise the stub allowance string is shown unchanged (preview build, offline).
 */
export function Allowance() {
  const stub = useSession((s) => s.allowance);
  const quota = useSession((s) => s.quota);
  const left = quota ? quota.left : stub;
  const limit = quota ? quota.limit : limits.visitorAiDocsPerDay;
  return (
    <div className="allow" data-testid="ai-allowance" data-source={quota ? 'quota' : 'stub'}>
      <Icon name="spark" />
      <span>
        <b>
          {left} of {limit}
        </b>{' '}
        fresh-AI documents left today
      </span>
    </div>
  );
}
