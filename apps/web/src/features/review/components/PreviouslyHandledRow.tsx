import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { memoryLabelText } from '../memory-labels';
import type { Row } from '../model';
import { reasonLabel } from '../reasons';

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "Previously handled (n)": collapsed row pinned at the bottom of the findings column (AC49). */
export function PreviouslyHandledRow({ items }: { items: Row[] }) {
  const [open, setOpen] = useState(false);
  const reopen = useReview((s) => s.reopen);
  const funds = [...new Set(items.map((r) => r.prior?.fund_name).filter(Boolean))].join(', ');
  return (
    <section className="prevwrap" aria-label="Previously handled">
      <button
        className="prevbtn"
        type="button"
        data-testid="previously-handled-toggle"
        aria-expanded={open}
        aria-controls="prevlist"
        onClick={() => setOpen(!open)}
      >
        <Icon name="chev" />
        <span>
          Previously handled (<span data-testid="previously-handled-count">{items.length}</span>)
        </span>
        <span className="help">{funds}</span>
      </button>
      <div className="prevlist" id="prevlist" hidden={!open}>
        {items.length ? (
          items.map((r) => (
            <div
              className="pcard"
              key={r.f.id}
              data-testid="previously-handled-item"
              data-memory-label={r.label}
              data-finding-id={r.f.id}
            >
              <div className="pt">{r.f.title}</div>
              <div className="pm">
                {memoryLabelText(r.label, r.prior?.fund_name)} · {r.prior?.decided_by_name} ·{' '}
                {r.prior?.fund_name || 'another fund'} ·{' '}
                {r.prior ? fmtDate(r.prior.decided_at) : ''}
              </div>
              {r.prior?.reason_code ? (
                <div className="pa">Reason: {reasonLabel(r.prior.reason_code)}</div>
              ) : null}
              {r.prior?.counsel_option ? (
                <div className="pa">Prior answer: counsel chose {r.prior.counsel_option}</div>
              ) : null}
              <div className="acts">
                <button
                  className="btn sm"
                  type="button"
                  data-testid="reopen-decision"
                  onClick={() => void reopen(r.f.id)}
                >
                  <Icon name="undo" />
                  Reopen decision
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Nothing from memory is set aside for this document.</div>
        )}
      </div>
    </section>
  );
}
