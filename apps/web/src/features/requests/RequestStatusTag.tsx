import { Icon } from '../../components/ui/icon';
import { STATUS_LABEL, type RequestStatus } from './request-model';

const CLS: Record<Exclude<RequestStatus, 'none'>, string> = {
  draft: 'tag t-st',
  sent: 'tag t-st',
  partly: 'tag t-warn',
  answered: 'tag t-ok',
};

function sentDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Request status tag, plus "Overdue" when Needed by has passed. */
export function RequestStatusTag({
  status,
  overdue,
  sentAt,
  testId,
}: {
  status: RequestStatus;
  overdue: boolean;
  sentAt?: number | undefined;
  testId?: string;
}) {
  if (status === 'none')
    return (
      <span className="mut" data-testid={testId} data-status="none">
        {STATUS_LABEL.none}
      </span>
    );
  return (
    <span className="rq-tags" data-testid={testId} data-status={status} data-overdue={overdue}>
      <span className={CLS[status]}>
        {status === 'answered' ? <Icon name="check" /> : null}
        {status === 'sent' && sentAt ? `Sent ${sentDay(sentAt)}` : STATUS_LABEL[status]}
      </span>
      {overdue ? (
        <span className="tag t-re">
          <Icon name="clock" />
          Overdue
        </span>
      ) : null}
    </span>
  );
}
