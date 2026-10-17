import { Icon } from '../components/ui/icon';
import { useSync } from '../state/memory-sync';

/** One quiet chip with the number of memory writes not yet synced (hidden at 0). */
export function UnsyncedChip() {
  const n = useSync((s) => s.unsynced);
  const deferred = useSync((s) => s.deferred);
  const parked = useSync((s) => s.parked);
  if (!n) return null;
  const text = deferred
    ? `${n} unsynced · memory limit reached, retries tomorrow`
    : parked
      ? `${n} unsynced · memory unavailable, retries on reload`
      : `${n} unsynced`;
  return (
    <span className="syncchip" role="status" data-testid="unsynced-chip" title={text}>
      <Icon name="clock" />
      <span className="lbl">{text}</span>
    </span>
  );
}
