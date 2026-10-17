import { Icon } from '../components/ui/icon';
import type { FeatureModule } from '../features/registry';
import { isRail, useShell, type Route } from '../state/shell';

export function NavGroup({
  id,
  label,
  items,
  badges,
  firmName,
}: {
  id: string;
  label: string;
  items: FeatureModule[];
  badges: Partial<Record<string, { n: number; sr: string }>>;
  firmName: string;
}) {
  const route = useShell((s) => s.route);
  const setRoute = useShell((s) => s.setRoute);
  const rail = useShell(isRail);
  return (
    <div>
      <p className="gl" id={`g-${id}`}>
        {label}
      </p>
      <ul aria-labelledby={`g-${id}`}>
        {items.map((m) => {
          const text =
            m.id === 'memory' ? (firmName ? `${firmName} memory` : 'Firm memory') : m.label;
          const b = badges[m.id];
          return (
            <li key={m.id}>
              <button
                className="ni"
                type="button"
                data-testid={`nav-${m.id}`}
                aria-current={route === m.id ? 'page' : undefined}
                title={rail ? text : undefined}
                onClick={() => {
                  setRoute(m.id as Route);
                  requestAnimationFrame(() =>
                    document.getElementById(`h-${m.id}`)?.focus({ preventScroll: true }),
                  );
                }}
              >
                <Icon name={m.icon} />
                <span className="lbl">{text}</span>
                {m.id === 'findings' || m.id === 'counsel' || m.id === 'structure' ? (
                  // aria-hidden: the visible count is announced by the sr suffix below so the
                  // accessible name starts with the visible label (WCAG 2.5.3 label in name).
                  <span className="nc" data-testid={`nav-badge-${m.id}`} aria-hidden="true">
                    {b && b.n > 0 ? (
                      <>
                        {m.id === 'structure' ? <Icon name="warn" /> : null}
                        <span className="sr">{b.sr}: </span>
                        {b.n}
                      </>
                    ) : null}
                  </span>
                ) : null}
                {b && b.n > 0 ? (
                  <span className="sr">
                    {' '}
                    {b.n} {b.sr.toLowerCase()}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
