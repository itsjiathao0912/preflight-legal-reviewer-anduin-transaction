import { Icon } from '../components/ui/icon';
import { Popover } from '../components/ui/popover';
import { useGatePopover } from '../features/gate/gate-store';
import { GateReasons } from '../features/gate/GateReasons';
import { useReviewView } from '../features/review/use-review-view';

export function GateButton() {
  const open = useGatePopover((s) => s.open);
  const setOpen = useGatePopover((s) => s.setOpen);
  const { gate, rows } = useReviewView();
  const n = gate.reasons.length;
  const blocked = gate.status === 'blocked';
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
      <GateReasons reasons={gate.reasons} rows={rows} onGo={() => setOpen(false)} />
    </Popover>
  );
}
