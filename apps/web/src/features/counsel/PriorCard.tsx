import { maskQuote, templateInterpretations } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import type { Row } from '../review/model';
import { AnswerForm, fmtDay } from './AnswerForm';
import { isClearAnswer } from './sheet-model';

/**
 * Prior-memory item not on this sheet (never exported): Already answered (with the prior answer)
 * or Awaiting counsel (D-3: counsel's answer can be recorded here; a clear answer resolves it for
 * the gate, "unclear" keeps it awaiting).
 */
export function PriorCard({
  r,
  answering,
  defaultBy,
  onAnswer,
}: {
  r: Row;
  answering: boolean;
  defaultBy: string;
  onAnswer: (on: boolean) => void;
}) {
  const recordAnswer = useReview((s) => s.recordAnswer);
  const here = isClearAnswer(r.triage?.counselAnswer);
  const answered = here || r.label === 'already_answered';
  const kind = answered ? 'answered' : 'awaiting';
  const crit = r.f.severity === 'critical' && r.f.detector_kind !== 'ai';
  const p = r.prior;
  const readings = templateInterpretations(r.f.issue_class);
  return (
    <div
      className="pcard"
      id={`cs-x-${r.f.id}`}
      data-testid="counsel-prior"
      data-finding-id={r.f.id}
      data-kind={kind}
    >
      <div className="l1">
        {answered ? (
          <span className="tag t-ok">
            <Icon name="check" />
            Already answered
          </span>
        ) : (
          <span className="tag t-st">
            <Icon name="clock" />
            Awaiting counsel
          </span>
        )}
        {crit ? (
          <span className="badge b-block">
            <Icon name="stop" />
            Blocks digitization
          </span>
        ) : null}
        <span className="dim">{r.f.classLabel}</span>
      </div>
      <div className="pt">{r.f.title}</div>
      <blockquote className="ev">{maskQuote(r.f.quote)}</blockquote>
      {here ? (
        <dl>
          <dt>Answer</dt>
          <dd>
            Counsel chose {r.triage?.counselAnswer}
            {r.triage?.counselNote ? `: ${r.triage.counselNote}` : ''}
          </dd>
          <dt>Fund</dt>
          <dd>this fund</dd>
          <dt>By</dt>
          <dd>
            {r.triage?.answeredBy ?? ''}
            {r.triage?.answeredAt ? `, ${fmtDay(r.triage.answeredAt)}` : ''}
          </dd>
        </dl>
      ) : answered && p ? (
        <dl>
          <dt>Prior answer</dt>
          <dd>
            {p.counsel_option ? `Counsel chose ${p.counsel_option}` : 'Answered'}
            {p.counsel_note ? `: ${p.counsel_note}` : ''}
          </dd>
          <dt>Fund</dt>
          <dd>{p.fund_name || 'another fund'}</dd>
          <dt>By</dt>
          <dd>
            {p.decided_by_name}, {fmtDay(p.decided_at)}
          </dd>
        </dl>
      ) : (
        <dl>
          <dt>Sent</dt>
          <dd>
            {p ? `${fmtDay(p.decided_at)} by ${p.decided_by_name} · ${p.fund_name}` : 'Earlier'}
          </dd>
          <dt>Status</dt>
          <dd>
            No answer yet.{' '}
            {crit ? 'Counts as unresolved for the gate.' : 'Does not block the gate.'}
            {r.triage?.counselAnswer === 'unclear' ? ' Last answer: unclear.' : ''}
          </dd>
        </dl>
      )}
      {answering ? (
        <AnswerForm
          id={r.f.id}
          readings={readings}
          defaultBy={defaultBy}
          onCancel={() => onAnswer(false)}
          onSave={async (a) => {
            onAnswer(false);
            await recordAnswer(r.f.id, a);
          }}
        />
      ) : kind === 'awaiting' ? (
        <div className="acts">
          <button
            type="button"
            className="btn"
            data-testid="counsel-prior-record"
            onClick={() => onAnswer(true)}
          >
            <Icon name="counsel" />
            Record counsel&apos;s answer
          </button>
        </div>
      ) : null}
    </div>
  );
}
