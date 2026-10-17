import type { VarianceMeta } from '@aduin/core';
import { DETERMINISTIC_LINE } from './types';

/** Impact from the logic graph (deterministic): investor types, paths, reusable, uncertain. */
export function ImpactLines({ impact }: { impact: VarianceMeta['impact'] }) {
  if (!impact) return null;
  const paths = impact.conditionals
    .map((c) => `${c.old ?? 'none'} → ${c.new ?? 'none'}`)
    .join('; ');
  return (
    <div className="impact" data-testid="change-impact">
      <div className="ih">
        <b>Impact</b>
        <span data-testid="impact-source">{DETERMINISTIC_LINE}</span>
      </div>
      <dl>
        <dt>Investor types</dt>
        <dd data-testid="impact-investors">
          {impact.investor_types.length ? impact.investor_types.join(', ') : 'none affected'}
        </dd>
        <dt>Paths</dt>
        <dd data-testid="impact-paths">{paths || 'none affected'}</dd>
        <dt>Old form rule reusable</dt>
        <dd data-testid="impact-reusable">
          <b>{impact.reusable}</b>
        </dd>
        {impact.uncertain ? (
          <>
            <dt>Confidence</dt>
            <dd data-testid="impact-uncertain">uncertain</dd>
          </>
        ) : null}
      </dl>
      {impact.line ? <p className="mut">{impact.line}</p> : null}
    </div>
  );
}
