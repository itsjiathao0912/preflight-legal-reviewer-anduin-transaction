import { Icon } from '../components/ui/icon';
import { useSync } from '../state/memory-sync';

/** One quiet chip with the number of memory writes not yet synced (hidden at 0). */
export function UnsyncedChip() {
  const n = useSync((s) => s.unsynced);
  const deferred = useSync((s) => s.deferred);
  if (!n) return null;
  const text = deferred
    ? `${n} unsynced · memory limit reached, retries tomorrow`
    : `${n} unsynced`;
  return (
    <span className="syncchip" role="status" data-testid="unsynced-chip" title={text}>
      <Icon name="clock" />
      <span className="lbl">{text}</span>
    </span>
  );
}
