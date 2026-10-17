import type { CoverageStatus } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { TYPE_LABELS } from '../open-document/PackageConfirmTable';
import type { PackageView } from './contract';

export const COVERAGE_STATUS = {
  full: { icon: 'check', label: 'Full' },
  partial: { icon: 'warn', label: 'Partial' },
  blocked: { icon: 'stop', label: 'Blocked' },
} as const satisfies Record<CoverageStatus, { icon: string; label: string }>;

export function PackageCoverageTable({ view }: { view: PackageView }) {
  return (
    <section
      className="pkg-lens-sec"
      data-testid="package-lens-coverage"
      aria-label="Check coverage"
    >
      <h3>Check coverage</h3>
      <p className="mut">{view.coverageLine}</p>
      <table className="pkg-lens-table">
        <thead>
          <tr>
            <th scope="col">Check group</th>
            <th scope="col">Status</th>
            <th scope="col">Missing</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {view.coverage.map((g) => {
            const st = COVERAGE_STATUS[g.status];
            return (
              <tr
                key={g.id}
                data-testid="package-coverage-group"
                data-group={g.id}
                data-status={g.status}
              >
                <td>{g.label}</td>
                <td>
                  <span className="pkg-lens-st">
                    <Icon name={st.icon} />
                    {st.label}
                  </span>
                </td>
                <td>
                  {g.missingTypes.length
                    ? g.missingTypes.map((t) => TYPE_LABELS[t]).join(', ')
                    : 'None'}
                </td>
                <td className="pkg-lens-reason">{g.reasons.join(' ') || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
