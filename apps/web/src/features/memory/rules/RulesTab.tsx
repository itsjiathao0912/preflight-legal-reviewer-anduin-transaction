import type { AuditEvent, Rule } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { useAiLane } from '../../ai/ai-lane';
import { shortDate } from '../decisions/DecisionRow';
import { ruleWhoWhen, type MatchingDismissals } from '../memory-join';
import { SuggestedStrip } from './SuggestedStrip';

const RO_TIP = 'This demo workspace is read-only.';

/**
 * Rules tab (AC53/AC54 UI): Suggested strip, Active rules table (who/when from audit, X5), Add
 * rule, Deactivate, rejected suggestions muted under a caption. No Edit action (X1).
 */
export function RulesTab({
  rules,
  audit,
  firmName,
  readOnly,
  matching,
  onReview,
  onAdd,
  onDeactivate,
}: {
  rules: readonly Rule[];
  audit: readonly AuditEvent[];
  firmName: string;
  readOnly: boolean;
  matching: (rule: Rule) => MatchingDismissals;
  onReview: (rule: Rule) => void;
  onAdd: () => void;
  onDeactivate: (rule: Rule) => void;
}) {
  const rulesNotice = useAiLane((s) => s.rulesNotice);
  const proposed = rules.filter((r) => r.status === 'proposed');
  const active = rules.filter((r) => r.status === 'active');
  const rejected = rules.filter((r) => r.status === 'rejected');

  return (
    <div data-testid="memory-rules">
      <SuggestedStrip rules={proposed} matching={matching} onReview={onReview} />
      <section aria-labelledby="mem-hAct">
        <div className="rhead">
          <h3 id="mem-hAct">Active rules ({active.length})</h3>
          <span className="mut">AI context only, never a filter. This firm only.</span>
          <button
            className="btn"
            type="button"
            data-testid="memory-add-rule"
            disabled={readOnly}
            title={readOnly ? RO_TIP : undefined}
            onClick={onAdd}
          >
            <Icon name="plus" />
            Add rule
          </button>
        </div>
        {active.length ? (
          <table className="t fx" data-testid="memory-active-rules">
            <caption className="sr">Active rules for {firmName || 'this firm'}</caption>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th style={{ width: 170 }} scope="col">
                  Added by
                </th>
                <th style={{ width: 120 }} scope="col">
                  Date
                </th>
                <th style={{ width: 130 }} scope="col">
                  <span className="sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const ww = ruleWhoWhen(r, audit);
                return (
                  <tr key={r.id} data-testid="memory-rule" data-rule-id={r.id}>
                    <td title={r.text}>{r.text}</td>
                    <td>{ww?.who ?? ''}</td>
                    <td>{ww ? shortDate(ww.at) : ''}</td>
                    <td className="act">
                      <button
                        className="linkbtn"
                        type="button"
                        data-testid="memory-deactivate"
                        aria-label={`Deactivate rule ${r.id}`}
                        disabled={readOnly}
                        title={readOnly ? RO_TIP : undefined}
                        onClick={() => onDeactivate(r)}
                      >
                        Deactivate…
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty2" data-testid="memory-no-rules">
            No active rules.
          </div>
        )}
        <p className="mut ainfo" data-testid="memory-ai-info">
          The AI receives at most 20 active rules (4096 bytes) per request
          {rulesNotice ? `; ${rulesNotice}` : ''}.
        </p>
      </section>
      {rejected.length ? (
        <section className="rejected" aria-labelledby="mem-hRej" data-testid="memory-rejected">
          <div className="rhead">
            <h3 id="mem-hRej">Rejected ({rejected.length})</h3>
            <span className="mut">
              Inactive. A rejected suggestion can return only if new matching dismissals arrive.
            </span>
          </div>
          <ul className="ev">
            {rejected.map((r) => (
              <li key={r.id} data-testid="memory-rejected-rule" data-rule-id={r.id}>
                {r.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
