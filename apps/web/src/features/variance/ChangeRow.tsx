import type { Owner, VarianceMeta } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import { useReview } from '../../state/review';
import type { Row } from '../review/model';
import { reasonLabel } from '../review/reasons';
import { ChangeDiff } from './ChangeDiff';
import { ImpactLines } from './ImpactLines';
import '../../styles/variance.css';

const OWNER_LABEL: Record<Owner, string> = {
  counsel: 'Counsel',
  gp: 'GP',
  fund_admin: 'Fund admin',
};

export function ownerLabel(owners: readonly Owner[]): string {
  return owners.length ? owners.map((o) => OWNER_LABEL[o]).join(' + ') : 'You';
}

/**
 * One change row: type chip (New / Logic), title, owner chip (read-only from suggested owners in
 * V2), status icons. Expanded: old above new, impact, provenance and the two V2 actions (local
 * triage only: "Mark as expected…" = Dismiss modal with a reason; "Ask owner" = Needs counsel).
 */
export function ChangeRow({
  r,
  meta,
  selected,
  baselineLabel,
  currentLabel,
  onDismiss,
}: {
  r: Row;
  meta: VarianceMeta | undefined;
  selected: boolean;
  baselineLabel: string;
  currentLabel: string;
  onDismiss: (id: string, opener: HTMLElement) => void;
}) {
  const select = useReview((s) => s.select);
  const needsCounsel = useReview((s) => s.needsCounsel);
  const restore = useReview((s) => s.restore);
  const f = r.f;
  const isNew = meta?.change_type === 'new';
  const owners = meta?.owners ?? [];
  return (
    <li className={`row${selected ? ' sel' : ''}${r.status === 'dismissed' ? ' done' : ''}`}>
      <button
        className="rowb"
        type="button"
        data-testid="finding-row"
        data-finding-id={f.id}
        data-kind="change"
        data-change-type={meta?.change_type ?? 'changed_logic'}
        data-status={r.status}
        aria-expanded={selected}
        onClick={() => select(f.id)}
      >
        <span className={isNew ? 'ct ct-new' : 'ct ct-logic'} data-testid="change-type">
          {isNew ? 'New' : 'Logic'}
          <span className="sr">: change vs baseline. </span>
        </span>
        <span className="t" title={f.title} data-testid="finding-title">
          {f.title}
        </span>
        <span className="rm">
          <span className="ochip" data-testid="owner-chip">
            {ownerLabel(owners)}
          </span>
          {r.status === 'counsel' ? (
            <span title="Asked owner">
              <Icon name="counsel" />
              <span className="sr">Asked owner. </span>
            </span>
          ) : null}
          {r.status === 'dismissed' ? (
            <span title="Marked as expected">
              <Icon name="x" />
              <span className="sr">Marked as expected. </span>
            </span>
          ) : null}
          <span>{f.ref}</span>
        </span>
      </button>
      {selected ? (
        <div className="rbody" data-testid="finding-body">
          <p className="sub2">
            <b>{isNew ? 'New' : 'Changed logic'}</b> · Change vs baseline · {f.loc}
          </p>
          <ChangeDiff
            oldText={meta?.old_text ?? ''}
            newText={meta?.new_text ?? ''}
            baselineLabel={baselineLabel}
            currentLabel={currentLabel}
          />
          <ImpactLines impact={meta?.impact ?? null} />
          {meta?.owner_reason ? (
            <p className="mut" data-testid="owner-reason">
              Suggested owner: {ownerLabel(owners)}. {meta.owner_reason}
            </p>
          ) : null}
          <div className="prov">
            <span data-testid="change-provenance">
              <Icon name="rule" />
              Rule {meta?.rule_id ?? f.detector_id} · deterministic ·{' '}
              {meta ? `${meta.variance_rules_version} (${meta.variance_rules_hash8})` : ''}
            </span>
          </div>
          {r.status === 'dismissed' ? (
            <div className="acts">
              <button
                className="btn"
                type="button"
                data-testid="action-restore"
                onClick={() => void restore(f.id)}
              >
                <Icon name="undo" />
                Restore change
              </button>
              {r.triage?.reasonCode ? (
                <span className="dim rsn">Reason: {reasonLabel(r.triage.reasonCode)}</span>
              ) : null}
            </div>
          ) : (
            <div className="acts">
              <button
                className="btn"
                type="button"
                data-testid="action-dismiss"
                onClick={(e) => onDismiss(f.id, e.currentTarget)}
              >
                <Icon name="check" />
                Mark as expected…
              </button>
              <button
                className="btn"
                type="button"
                data-testid="action-counsel"
                aria-pressed={r.status === 'counsel'}
                onClick={() => void needsCounsel(f.id)}
              >
                <Icon name="counsel" />
                Ask owner
              </button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
