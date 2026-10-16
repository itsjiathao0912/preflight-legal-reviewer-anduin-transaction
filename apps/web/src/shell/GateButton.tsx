import { useState } from 'react';
import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { GATE_REASON_TEXT } from '../features/review/gateInterim';
import { useReviewView } from '../features/review/use-review-view';
import { useFilters } from '../state/filters';
import { useReview } from '../state/review';
import { useShell } from '../state/shell';

export function GateButton() {
  const [open, setOpen] = useState(false);
  const { gate, rows } = useReviewView();
  const select = useReview((s) => s.select);
  const setRoute = useShell((s) => s.setRoute);
  const reset = useFilters((s) => s.reset);
  const n = gate.reasons.length;
  const blocked = gate.status === 'blocked';
  const byId = new Map(rows.map((r) => [r.f.id, r]));
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Digitization gate"
      className="pop-gate"
      testId="gate-popover"
      side="right"
      align="end"
      trigger={
        <button className={blocked ? 'gate' : 'gate ready'} type="button" data-testid="gate-button">
          <Icon name={blocked ? 'lock' : 'unlock'} />
          <span className="lbl">{blocked ? `Blocked · ${n}` : 'Ready to digitize'}</span>
          {blocked ? (
            <span className="gn" aria-hidden="true">
              {n}
            </span>
          ) : null}
          <Icon name="chev" />
        </button>
      }
    >
      <h2>{blocked ? 'Digitization is blocked' : 'All critical items are resolved'}</h2>
      <p>
        {blocked
          ? 'These critical items are not resolved. Select one to go to it.'
          : 'Every item that blocks digitization has been dismissed with a reason or answered by counsel.'}
      </p>
      <ul>
        {gate.reasons.map((r) => {
          const row = byId.get(r.findingKey);
          return (
            <li key={r.findingKey}>
              <button
                className="gli"
                type="button"
                data-testid="gate-reason"
                data-finding-id={r.findingKey}
                data-kind={r.kind}
                onClick={() => {
                  setOpen(false);
                  setRoute('findings');
                  reset();
                  select(r.findingKey);
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLElement>(
                        `[data-testid="finding-row"][data-finding-id="${r.findingKey}"]`,
                      )
                      ?.focus({ preventScroll: true }),
                  );
                }}
              >
                <Icon name="stop" />
                <span>
                  <b>{row?.f.title ?? r.findingKey}</b>
                  <span className="why">
                    {row?.f.loc ?? ''} · {GATE_REASON_TEXT[r.kind]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
