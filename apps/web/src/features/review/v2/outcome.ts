import type { ReasonCode } from '@aduin/core';
import type { Row, Triage } from '../model';
import type { OwnerAsk } from '../../../state/review';
import { questionRows } from '../../counsel/sheet-model';
import { reviewGate, type ReviewGate } from '../../variance/select';
import { isBlocking } from './groups';

export type OutcomeAction = 'ask-counsel' | 'close-real-issue' | 'close-dismiss' | 'move-back';

export interface OutcomeInput {
  rows: readonly Row[];
  id: string;
  action: OutcomeAction;
  ask?: OwnerAsk;
  reason?: ReasonCode;
  result: { blocks: readonly unknown[] } | null | undefined;
  policy: Parameters<typeof reviewGate>[2];
}

export interface Outcome {
  text: string;
  questionCount: number;
  gateBefore: 'ready' | 'blocked';
  gateAfter: 'ready' | 'blocked';
  gateReasons: number;
  unreadable: boolean;
}

const SEP = ' · ';

/** The triage the store would write for this action (mirrors state/review.ts, E3). */
function nextTriage(row: Row, input: Pick<OutcomeInput, 'action' | 'ask' | 'reason'>): Triage {
  const prev = row.triage;
  switch (input.action) {
    case 'ask-counsel': {
      if (row.f.kind !== 'change' && isBlocking(row))
        return { ...(prev ?? {}), status: 'accepted' };
      const next: Triage = { ...(prev ?? {}), status: 'counsel' };
      const ask = input.ask;
      if (ask && ask.owners.length) {
        const oa = { ...(prev?.ownerAnswers ?? {}) };
        for (const o of ask.owners) if (!(o in oa)) oa[o] = null;
        next.ownerAnswers = oa;
        next.ownerSource = ask.source;
      }
      return next;
    }
    case 'close-real-issue':
      return { ...(prev ?? {}), status: 'accepted' };
    case 'close-dismiss':
      return input.reason !== undefined
        ? { status: 'dismissed', reasonCode: input.reason }
        : { status: 'dismissed' };
    case 'move-back':
      return { status: 'open' };
  }
}

/** Pure copy of `rows` with the acted row's status and triage changed as the store would. */
export function simulateStatus(
  rows: readonly Row[],
  input: Pick<OutcomeInput, 'id' | 'action' | 'ask' | 'reason'>,
): Row[] {
  return rows.map((r) => {
    if (r.f.id !== input.id) return r;
    const triage = nextTriage(r, input);
    return { ...r, triage, status: triage.status };
  });
}

function gateText(before: ReviewGate, after: ReviewGate): string {
  if (after.unreadable) return 'Gate not ready (no text read)';
  const m = after.reasons.length;
  if (after.status === 'blocked')
    return before.status === 'blocked' ? `Gate still blocked (${m})` : `Gate now blocked (${m})`;
  return before.status === 'blocked' ? 'Gate now ready' : 'Gate ready';
}

/** D12 toast text plus the numbers behind it. */
export function computeOutcome(input: OutcomeInput): Outcome {
  const before = reviewGate(input.rows, input.result, input.policy);
  const simulated = simulateStatus(input.rows, input);
  const after = reviewGate(simulated, input.result, input.policy);
  const n = questionRows(simulated).length;
  const gate = gateText(before, after);
  let text: string;
  switch (input.action) {
    case 'ask-counsel':
      text = ['Sent to counsel', `Counsel questions now ${n}`, gate].join(SEP);
      break;
    case 'close-real-issue':
      text = ['Closed as a real issue', gate].join(SEP);
      break;
    case 'close-dismiss':
      text = ['Closed', gate].join(SEP);
      break;
    case 'move-back':
      text = ['Moved back to review', `Counsel questions now ${n}`, gate].join(SEP);
      break;
  }
  return {
    text,
    questionCount: n,
    gateBefore: before.status,
    gateAfter: after.status,
    gateReasons: after.reasons.length,
    unreadable: after.unreadable,
  };
}
