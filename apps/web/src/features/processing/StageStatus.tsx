import { useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { Popover } from '../../components/ui/popover';
import type { IconName } from '../../icons/sprite';
import type { StageId, StageReport } from '../../engine/types';
import { STAGE_ORDER, useReview } from '../../state/review';
import { useSession } from '../../state/session';
import { useAiLane, type LaneState } from '../ai/ai-lane';
import { BANNERS } from '../ai/banner-map';

const LABEL: Record<StageId, string> = {
  read: 'Reading',
  structure: 'Structuring',
  checks: 'Checks',
  ai: 'AI review',
  done: 'Done',
};

/** AI-stage line and button suffix per lane state (the button always starts with "Checks done"). */
function aiStage(
  lane: LaneState,
  docId: string | null,
  aiOn: boolean,
  failed: StageId | null,
  checksDone: boolean,
): { report: StageReport; suffix: string; finished: boolean; withAi: boolean } {
  const r = (state: StageReport['state'], sub: string): StageReport => ({ id: 'ai', state, sub });
  if (!aiOn)
    return {
      report: r('skipped', 'Skipped · AI is off'),
      suffix: 'off',
      finished: true,
      withAi: false,
    };
  if (failed)
    return {
      report: r('skipped', 'Skipped · an earlier stage failed'),
      suffix: 'skipped',
      finished: true,
      withAi: false,
    };
  if (!checksDone || lane.docId !== docId)
    return {
      report: r('pending', 'Waiting for checks'),
      suffix: 'pending',
      finished: false,
      withAi: false,
    };
  const n = lane.count;
  const sugg = `${n} AI suggestion${n === 1 ? '' : 's'}`;
  switch (lane.status) {
    case 'off':
      return {
        report: r('skipped', 'Skipped · AI is off'),
        suffix: 'off',
        finished: true,
        withAi: false,
      };
    case 'idle':
      return {
        report: r('skipped', 'Skipped · AI review is not connected in this build'),
        suffix: 'not connected',
        finished: true,
        withAi: false,
      };
    case 'pending':
      return {
        report: r('pending', 'Running · AI review in progress'),
        suffix: 'running',
        finished: false,
        withAi: false,
      };
    case 'cache':
      return {
        report: r('done', `Done · ${sugg} from cache`),
        suffix: 'from cache',
        finished: true,
        withAi: true,
      };
    case 'fresh':
      return { report: r('done', `Done · ${sugg}`), suffix: 'done', finished: true, withAi: true };
    case 'not_precomputed':
      return {
        report: r('todo', 'Not run · no saved AI review for this sample'),
        suffix: 'not run',
        finished: true,
        withAi: false,
      };
    case 'skipped': {
      const why = lane.banner ? BANNERS[lane.banner].short : (lane.note ?? 'skipped');
      return {
        report: r('skipped', `Skipped · ${why}`),
        suffix: 'skipped',
        finished: true,
        withAi: false,
      };
    }
    case 'unavailable': {
      const why = lane.banner ? BANNERS[lane.banner].short : 'unavailable';
      return {
        report: r('skipped', `Unavailable · ${why}`),
        suffix: 'unavailable',
        finished: true,
        withAi: false,
      };
    }
  }
}

/** Named stages (AC3): read, structure, checks, AI review (lane state), done. */
export function useStages(): {
  list: StageReport[];
  button: string;
  failed: StageId | null;
  busy: boolean;
} {
  const stages = useReview((s) => s.stages);
  const phase = useReview((s) => s.phase);
  const docId = useReview((s) => s.doc?.id ?? null);
  const aiOn = useSession((s) => s.aiOn);
  const lane = useAiLane();
  const failed =
    (STAGE_ORDER.find((id) => stages[id]?.state === 'failed') as StageId | undefined) ?? null;
  const checksDone = stages.checks?.state === 'done';
  // while a document loads, the lane belongs to it once analyzed (docId is set at ready)
  const laneDoc = phase === 'loading' ? lane.docId : docId;
  const ai = aiStage(lane, laneDoc, aiOn, failed, checksDone);
  const list: StageReport[] = STAGE_ORDER.map((id) => {
    if (id === 'ai') return ai.report;
    if (id === 'done') {
      if (failed) return { id, state: 'failed', sub: `Partial result · ${LABEL[failed]} failed` };
      if (checksDone && ai.finished)
        return { id, state: 'done', sub: ai.withAi ? 'Done · rules and AI' : 'Done · rules only' };
      if (checksDone) return { id, state: 'todo', sub: 'Waiting for AI review' };
      return { id, state: 'todo', sub: 'Not started' };
    }
    return stages[id] ?? { id, state: 'todo', sub: 'Not started' };
  });
  let button = 'No document open';
  if (phase === 'loading') button = 'Reading the document…';
  else if (failed) button = `${LABEL[failed]} failed · partial result`;
  else if (checksDone) button = `Checks done · AI review ${ai.suffix}`;
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
  const aiState = list.find((s) => s.id === 'ai')?.state;
  const lead: IconName = failed
    ? 'warn'
    : busy || aiState === 'pending'
      ? 'ring'
      : aiState === 'done'
        ? 'check'
        : 'skip';
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
