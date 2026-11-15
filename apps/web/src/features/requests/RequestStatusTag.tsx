import { Icon } from '../../components/ui/icon';
import { shortDay, STATUS_LABEL, type RequestStatus } from './request-model';

const CLS: Record<Exclude<RequestStatus, 'none'>, string> = {
  draft: 'tag t-st',
  sent: 'tag t-st',
  partly: 'tag t-warn',
  answered: 'tag t-ok',
};

/** Request status tag, plus "Overdue" when Needed by has passed. */
export function RequestStatusTag({
  status,
  overdue,
  sentAt,
  round = 0,
  testId,
}: {
  status: RequestStatus;
  overdue: boolean;
  sentAt?: number | undefined;
  /** Rounds sent; adds "Round N ·" once sent. */
  round?: number;
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
        {status === 'sent' && sentAt
          ? `${round ? `Round ${round} · sent` : 'Sent'} ${shortDay(sentAt)}`
          : round && status === 'partly'
            ? `Round ${round} · ${STATUS_LABEL[status]}`
            : STATUS_LABEL[status]}
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
