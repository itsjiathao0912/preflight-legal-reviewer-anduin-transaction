import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { gatePillView } from '../features/gate/gate-pill';
import { useGatePopover } from '../features/gate/gate-store';
import { GateReasons } from '../features/gate/GateReasons';
import { useReviewView } from '../features/review/use-review-view';
import { useReview } from '../state/review';

export function GateButton() {
  const open = useGatePopover((s) => s.open);
  const setOpen = useGatePopover((s) => s.setOpen);
  const hasDocument = useReview((s) => s.result !== null);
  const { gate, rows } = useReviewView();
  const v = gatePillView(hasDocument, gate);
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
        <button
          className={v.className}
          type="button"
          data-testid="gate-button"
          data-gate-state={v.state}
        >
          <Icon name={v.icon} />
          <span className="lbl">{v.label}</span>
          {v.state === 'blocked' ? (
            <span className="gn" aria-hidden="true">
              {gate.reasons.length}
            </span>
          ) : null}
          <Icon name="chev" />
        </button>
      }
    >
      <h2>{v.title}</h2>
      <p>{v.body}</p>
      {v.state === 'none' ? null : (
        <GateReasons reasons={gate.reasons} rows={rows} onGo={() => setOpen(false)} />
      )}
    </Popover>
  );
}
