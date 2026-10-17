import { Icon } from '../../components/ui/icon';
import { usePackageView } from '../package/package-view';
import '../../styles/package-gate.css';

/** One-line package coverage (AC-I17/AC-I18). Renders nothing outside a package. */
export function CoverageLine({ placement }: { placement: 'header' | 'popover' }) {
  const view = usePackageView();
  if (!view) return null;
  const status = view.coverageStatus;
  return (
    <p
      className={`pkg-gate-coverage pkg-gate-${status}`}
      data-testid={placement === 'header' ? 'findings-coverage-line' : 'gate-coverage-line'}
      data-status={status}
    >
      <Icon name={status === 'full' ? 'check' : status === 'blocked' ? 'stop' : 'warn'} />
      <span>{view.coverageLine}</span>
    </p>
  );
}
