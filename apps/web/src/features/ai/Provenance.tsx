import { Icon } from '../../components/ui/icon';
import type { FindingView } from '../../engine/types';

/** Label on every AI finding (same text as core AI_SUGGESTION_LABEL; main thread imports no core values). */
export const AI_SUGGESTION = 'AI suggestion';

/** Provenance chip: rule id for deterministic findings; model and fresh / from cache for AI findings. */
export function Provenance({ f }: { f: FindingView }) {
  if (f.detector_kind === 'rule') {
    return (
      <span data-testid="finding-provenance" data-provenance="rule">
        <Icon name="rule" />
        Rule {f.detector_id} · deterministic
      </span>
    );
  }
  const source = f.provenance === 'cache' ? 'cache' : 'fresh';
  return (
    <span data-testid="finding-provenance" data-provenance={source}>
      <span className="tag t-ai" data-testid="ai-suggestion-label">
        <Icon name="spark" />
        {AI_SUGGESTION}
      </span>
      {f.model ?? 'AI'} · {source === 'cache' ? 'from cache' : 'fresh'}
    </span>
  );
}
