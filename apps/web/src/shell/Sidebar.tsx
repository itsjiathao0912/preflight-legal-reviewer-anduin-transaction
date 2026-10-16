import { Icon } from '../components/ui/icon';
import { navModules, type NavGroupId } from '../features/registry';
import { useReviewView } from '../features/review/use-review-view';
import { useReview } from '../state/review';
import { isRail, useShell } from '../state/shell';
import { AiSwitch } from './AiSwitch';
import { AnalystBadge } from './AnalystBadge';
import { DocSwitcher } from './DocSwitcher';
import { GateButton } from './GateButton';
import { NavGroup } from './NavGroup';

const GROUPS: { id: NavGroupId; label: string }[] = [
  { id: 'review', label: 'Review' },
  { id: 'check', label: 'Check' },
  { id: 'firm', label: 'Firm' },
];

export function Sidebar() {
  const rail = useShell(isRail);
  const narrow = useShell((s) => s.narrow);
  const toggle = useShell((s) => s.toggleCollapsed);
  const firmName = useReview((s) => s.doc?.firmName ?? '');
  const { open, counsel } = useReviewView();
  const mods = navModules();
  const badges = {
    findings: { n: open, sr: 'Open' },
    counsel: { n: counsel, sr: 'Needs counsel' },
  };
  return (
    <aside className="side" data-testid="sidebar" aria-label="Sidebar">
      <div className="sbtop">
        <div className="brand">
          <svg className="i brand-logo" aria-hidden="true">
            <use href="#logo" />
          </svg>
          <span>Sub-doc QA</span>
        </div>
        <button
          className="ibtn"
          type="button"
          data-testid="sidebar-toggle"
          hidden={narrow}
          aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!rail}
          aria-controls="snav"
          onClick={toggle}
        >
          <Icon name="panel" />
        </button>
      </div>
      <DocSwitcher />
      <nav className="snav" id="snav" aria-label="Main">
        {GROUPS.map((g) => (
          <NavGroup
            key={g.id}
            id={g.id}
            label={g.label}
            items={mods.filter((m) => m.group === g.id)}
            badges={badges}
            firmName={firmName}
          />
        ))}
      </nav>
      <div className="sbbot">
        <GateButton />
        <AiSwitch />
        <AnalystBadge />
      </div>
    </aside>
  );
}
