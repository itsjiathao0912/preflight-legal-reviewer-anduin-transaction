import type { VarianceMeta } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { ChangeDiff } from '../../variance/ChangeDiff';
import { ImpactLines } from '../../variance/ImpactLines';
import { OwnerSelect } from '../../variance/OwnerChip';
import { useVariance } from '../../variance/variance-store';
import type { Row } from '../model';
// Variance styles (diff, impact, owner chip, change-type chip) were loaded by the old ChangeRow.
import '../../../styles/variance.css';

/**
 * D-2 adapter: change and regression rows keep the Variance parts inside the accordion (diff,
 * impact lines, owner select, provenance). Read-only reuse; the Ask owner button is the bar's.
 */
export function ChangeExpanded({ row, meta }: { row: Row; meta: VarianceMeta | undefined }) {
  const doc = useReview((s) => s.doc);
  const baseline = useVariance((s) => s.baseline);
  const f = row.f;
  const isNew = meta?.change_type === 'new';
  const isReg = meta?.kind === 'regression';
  const currentLabel = doc ? [doc.fund, doc.version].filter(Boolean).join(' ') || doc.name : '';
  return (
    <>
      <p className="fv2-sec-h fv2-sevline">
        <b>{isNew ? 'New' : isReg ? 'Regression' : 'Changed logic'}</b> ·{' '}
        {isReg ? 'Firm-template check' : 'Change vs baseline'} · {f.loc}
      </p>
      <div className="fv2-sec">
        <ChangeDiff
          oldText={meta?.old_text ?? ''}
          newText={meta?.new_text ?? ''}
          baselineLabel={baseline?.name ?? 'Baseline'}
          currentLabel={currentLabel}
        />
      </div>
      <ImpactLines impact={meta?.impact ?? null} />
      <OwnerSelect r={row} meta={meta} />
      <p className="fv2-sec-h">
        <span data-testid="change-provenance">
          <Icon name="rule" />
          Rule {meta?.rule_id ?? f.detector_id} · deterministic ·{' '}
          {meta ? `${meta.variance_rules_version} (${meta.variance_rules_hash8})` : ''}
        </span>
      </p>
    </>
  );
}
