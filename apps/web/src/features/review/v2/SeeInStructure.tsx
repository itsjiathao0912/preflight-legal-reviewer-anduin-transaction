import type { FindingView } from '../../../engine/types';
import { Icon } from '../../../components/ui/icon';
import { useShell } from '../../../state/shell';

/** Issue classes whose subject is a term the Structure "Terms" tab lists. */
const TERM_CLASSES: ReadonlySet<FindingView['issue_class']> = new Set(['defined_term_issue']);

/** Lowercased term from the finding's facts (undefined-term: used_term; defined-term-issues: term). */
export function structureKeyFor(f: FindingView): string | undefined {
  const facts = f.detail.facts;
  for (const k of ['used_term', 'term', 'target_key'] as const) {
    const v = facts[k];
    if (typeof v === 'string' && v.trim()) return v.trim().toLowerCase();
  }
  return undefined;
}

/** Details row linking a term finding to the Sources view instead of repeating its data. */
export function SeeInStructure({ f }: { f: FindingView }) {
  if (!TERM_CLASSES.has(f.issue_class)) return null;
  const go = () => {
    const key = structureKeyFor(f);
    const s = useShell.getState();
    s.setStructureFocus(key ? { tab: 'terms', key } : { tab: 'terms' });
    s.setFindingsView('sources');
  };
  return (
    <>
      <dt>Sources</dt>
      <dd>
        <button
          type="button"
          className="btn ghost sm"
          data-testid="finding-see-structure"
          title="Open this term in Sources"
          onClick={go}
        >
          <Icon name="file" />
          See in Sources →
        </button>
      </dd>
    </>
  );
}
