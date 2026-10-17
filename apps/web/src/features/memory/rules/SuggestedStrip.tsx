import type { Rule } from '@aduin/core';
import type { MatchingDismissals } from '../memory-join';

/** One-row "Suggested" strip per proposed rule (app.html `.strip`); Review opens the dialog. */
export function SuggestedStrip({
  rules,
  matching,
  onReview,
}: {
  rules: readonly Rule[];
  matching: (rule: Rule) => MatchingDismissals;
  onReview: (rule: Rule) => void;
}) {
  if (!rules.length) {
    return (
      <p className="mut" data-testid="memory-no-suggestions" style={{ marginBottom: 18 }}>
        No suggested rules. A rule is suggested after 3 or more dismissals of the same pattern with
        the same reason (not Other).
      </p>
    );
  }
  return (
    <section className="strip" aria-label="Suggested rules" data-testid="memory-suggested">
      {rules.map((r) => {
        const m = matching(r);
        return (
          <div className="srow" key={r.id} data-testid="memory-suggestion" data-rule-id={r.id}>
            <span className="rule" title={r.text}>
              <b>Suggested:</b> {r.text}
            </span>
            <span className="mut" data-testid="memory-suggestion-matching">
              {m.via === 'none'
                ? 'From repeated dismissals'
                : `${m.decisions.length} matching dismissal${m.decisions.length === 1 ? '' : 's'}`}
            </span>
            <button
              className="btn pri"
              type="button"
              data-testid="memory-review"
              onClick={() => onReview(r)}
            >
              Review
            </button>
          </div>
        );
      })}
    </section>
  );
}
