import type { FindingView } from '../../../engine/types';
import { Icon } from '../../../components/ui/icon';
import { OwnerChip } from '../../variance/OwnerChip';
import type { Row } from '../model';
import { SEV } from '../severity';
import { ChangeExpanded } from './ChangeExpanded';
import { ExpandedBlock } from './ExpandedBlock';
import { groupOf } from './groups';
import type { ReviewView } from './types';
import { metaFor } from './use-ask-owners';

function StatusTag({ row }: { row: Row }) {
  const g = groupOf(row);
  if (g === 'sent')
    return <span className="fv2-tag">{row.f.kind === 'change' ? 'Owner' : 'Counsel'}</span>;
  if (g === 'closed') return <span className="fv2-tag">Closed</span>;
  return null;
}

/**
 * D5 one-line row; the detail opens directly under it. Attribute parity with the shipped rows
 * (E28): `data-kind` is `row.f.kind` (a regression row is a change row), change rows add
 * `data-change-type` and `data-regression`, keep the change-type chip and the owner chip; error
 * rows keep the screen-reader severity label.
 */
export function AccordionRow({
  row,
  open,
  onToggle,
  view,
  twin,
}: {
  row: Row;
  open: boolean;
  onToggle(id: string): void;
  view: ReviewView;
  twin?: FindingView | undefined;
}) {
  const f = row.f;
  const change = f.kind === 'change';
  const meta = change ? metaFor(row, view) : undefined;
  const isNew = meta?.change_type === 'new';
  const isReg = meta?.kind === 'regression';
  const sev = SEV[row.sev];
  return (
    <li className={open ? 'fv2-row fv2-row-open' : 'fv2-row'}>
      <button
        type="button"
        className="fv2-rowb"
        data-testid="finding-row"
        data-finding-id={f.id}
        data-severity={row.sev}
        data-status={row.status}
        data-kind={f.kind ?? 'error'}
        {...(change
          ? {
              'data-change-type': meta?.change_type ?? 'changed_logic',
              ...(isReg ? { 'data-regression': '1' } : {}),
            }
          : {})}
        aria-expanded={open}
        onClick={() => onToggle(f.id)}
      >
        {change ? (
          <span className={isNew ? 'ct ct-new' : 'ct ct-logic'} data-testid="change-type">
            {isNew ? 'New' : isReg ? 'Regression' : 'Logic'}
            <span className="sr">: change vs baseline. </span>
          </span>
        ) : (
          <span className={`fv2-sev sv-${row.sev}`}>
            <Icon name={sev.icon} />
            <span className="sr">{sev.label}: </span>
          </span>
        )}
        <span className="fv2-title" title={f.title} data-testid="finding-title">
          {f.title}
        </span>
        {change ? <OwnerChip r={row} meta={meta} /> : null}
        <StatusTag row={row} />
        {!change && f.detector_kind === 'ai' ? (
          <span className="fv2-tag fv2-tag-ai" data-testid="ai-tag">
            <Icon name="spark" />
            AI<span className="sr"> suggestion</span>
          </span>
        ) : null}
        {twin ? (
          <span className="fv2-tag fv2-tag-ai" data-testid="ai-agrees-tag">
            <Icon name="spark" />
            AI agrees
          </span>
        ) : null}
        <span className="fv2-tag">{f.ref}</span>
      </button>
      {open ? (
        <div className="fv2-body" data-testid="finding-body">
          {change ? (
            <ChangeExpanded row={row} meta={meta} />
          ) : (
            <ExpandedBlock row={row} twin={twin} />
          )}
        </div>
      ) : null}
    </li>
  );
}
