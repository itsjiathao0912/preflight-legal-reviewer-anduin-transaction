import { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { Popover } from '../../components/ui/popover';
import type { IconName } from '../../icons/sprite';
import type { StageId, StageReport } from '../../engine/types';
import { STAGE_ORDER, useReview } from '../../state/review';
import { useSession } from '../../state/session';

const LABEL: Record<StageId, string> = {
  read: 'Reading',
  structure: 'Structuring',
  checks: 'Checks',
  ai: 'AI review',
  done: 'Done',
};

/** Named stages (AC3): read, structure, checks, AI review (pending until P05, or off), done. */
export function useStages(): {
  list: StageReport[];
  button: string;
  failed: StageId | null;
  busy: boolean;
} {
  const stages = useReview((s) => s.stages);
  const phase = useReview((s) => s.phase);
  const aiOn = useSession((s) => s.aiOn);
  const failed =
    (STAGE_ORDER.find((id) => stages[id]?.state === 'failed') as StageId | undefined) ?? null;
  const checksDone = stages.checks?.state === 'done';
  const list: StageReport[] = STAGE_ORDER.map((id) => {
    if (id === 'ai') {
      if (!aiOn) return { id, state: 'skipped', sub: 'Skipped · AI is off' };
      if (failed) return { id, state: 'skipped', sub: 'Skipped · an earlier stage failed' };
      return {
        id,
        state: 'pending',
        sub: checksDone ? 'Pending · AI review runs in a later build' : 'Waiting for checks',
      };
    }
    if (id === 'done') {
      if (failed) return { id, state: 'failed', sub: `Partial result · ${LABEL[failed]} failed` };
      if (checksDone && !aiOn) return { id, state: 'done', sub: 'Done · rules only' };
      return { id, state: 'todo', sub: 'Not started' };
    }
    return stages[id] ?? { id, state: 'todo', sub: 'Not started' };
  });
  let button = 'No document open';
  if (phase === 'loading') button = 'Reading the document…';
  else if (failed) button = `${LABEL[failed]} failed · partial result`;
  else if (checksDone) button = `Checks done · AI review ${aiOn ? 'pending' : 'off'}`;
  else if (phase === 'error') button = 'Processing failed';
  return { list, button, failed, busy: phase === 'loading' };
}

function iconFor(s: StageReport): { name: IconName; cls: string; spin: boolean } {
  switch (s.state) {
    case 'done':
      return { name: 'check', cls: 'done', spin: false };
    case 'pending':
    case 'running':
      return { name: 'ring', cls: 'pend', spin: true };
    case 'failed':
      return { name: 'warn', cls: 'fail', spin: false };
    case 'skipped':
      return { name: 'skip', cls: 'skipd', spin: false };
    case 'todo':
      return { name: 'todo', cls: 'todo', spin: false };
  }
}

export function StageStatus() {
  const [open, setOpen] = useState(false);
  const { list, button, failed, busy } = useStages();
  const aiPending = list.find((s) => s.id === 'ai')?.state === 'pending';
  const lead: IconName = failed ? 'warn' : busy || aiPending ? 'ring' : 'skip';
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Processing stages"
      className="pop-stage"
      testId="stage-popover"
      trigger={
        <button
          className={failed ? 'stagebtn failed' : 'stagebtn'}
          type="button"
          data-testid="stage-status-button"
        >
          <Icon name={lead} className={lead === 'ring' ? 'ring-pulse' : undefined} />
          <span>{button}</span>
          <Icon name="chevd" />
        </button>
      }
    >
      <h2>Processing stages</h2>
      <ol className="stages">
        {list.map((s) => {
          const ic = iconFor(s);
          return (
            <li
              key={s.id}
              className={ic.cls}
              data-testid="stage-item"
              data-stage={s.id}
              data-state={s.state}
              aria-current={
                s.state === 'running' || (s.id === 'ai' && s.state === 'pending')
                  ? 'step'
                  : undefined
              }
            >
              <Icon name={ic.name} className={ic.spin ? 'ring-pulse' : undefined} />
              <span className="lab">{LABEL[s.id]}</span>
              <span className="sub">{s.sub}</span>
            </li>
          );
        })}
      </ol>
    </Popover>
  );
}
