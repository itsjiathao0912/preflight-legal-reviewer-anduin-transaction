import { Icon } from '../../../components/ui/icon';
import type { Row } from '../model';
import { barState } from './action-plan';
import type { Control } from './types';

/** Tooltip on a disabled "Move back to review" (a recorded answer would be dropped locally). */
export const MOVE_BACK_ANSWERED =
  'An answer is recorded for this finding; it cannot be moved back.';

/** P-14 bar label for a row whose dismissal in another fund must be re-confirmed. */
export const RECONFIRM_LABEL = 'Re-confirm dismissal';

/**
 * D1, D3: one sticky bar for the open finding. Two equal buttons for an open row (or nothing open,
 * both disabled); "Move back to review" for a row already sent or closed.
 */
export function ActionBar({
  row,
  busy,
  askDisabled,
  askTitle,
  onControl,
}: {
  row: Row | null;
  busy: boolean;
  askDisabled: boolean;
  askTitle: string | undefined;
  onControl(c: Control): void;
}) {
  const st = barState(row);
  // R8: while a save is in flight the buttons stay focusable (aria-disabled) and ignore clicks
  const press = (c: Control) => {
    if (!busy) onControl(c);
  };
  const ariaBusy = busy ? true : undefined;
  // P-14: a memory re-confirm row keeps the old "Re-confirm dismissal" wording on the bar
  const closeLabel = row?.label === 'dismissed_reconfirm' ? RECONFIRM_LABEL : st.labels.close;
  return (
    <div
      className="fv2-bar"
      data-testid="action-bar"
      role="group"
      aria-label="Actions for the open finding"
    >
      {st.primary === 'move-back' ? (
        <button
          type="button"
          className="btn fv2-btn fv2-btn-outline"
          data-testid="action-restore"
          data-action="move-back"
          disabled={!st.moveBackEnabled}
          aria-disabled={ariaBusy}
          title={st.moveBackEnabled ? undefined : MOVE_BACK_ANSWERED}
          onClick={() => press('move-back')}
        >
          <Icon name="undo" />
          Move back to review
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn pri fv2-btn fv2-btn-fill"
            data-testid="action-counsel"
            data-action="ask-counsel"
            disabled={row === null || askDisabled}
            aria-disabled={ariaBusy}
            title={askDisabled ? askTitle : row ? `${st.labels.ask} (C)` : undefined}
            onClick={() => press('ask-counsel')}
          >
            <Icon name="counsel" />
            {st.labels.ask}
          </button>
          <button
            type="button"
            className="btn fv2-btn fv2-btn-outline"
            data-testid="action-dismiss"
            data-action="close-issue"
            disabled={!st.closeEnabled}
            aria-disabled={ariaBusy}
            title={row ? `${closeLabel} (X)` : undefined}
            onClick={() => press('close-issue')}
          >
            <Icon name="x" />
            {closeLabel}
          </button>
        </>
      )}
    </div>
  );
}
