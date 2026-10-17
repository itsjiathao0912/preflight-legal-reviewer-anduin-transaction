import type { GateFinding, GateState } from './types';

/** Inputs captured at export time (AC64). */
export interface MetricsInput {
  findings: readonly Pick<GateFinding, 'id' | 'detector_kind'>[];
  /** Triage states at export time. */
  states: Readonly<Record<string, GateState>>;
  /** Number of questions in the exported sheet. */
  sheetQuestionCount: number;
  /** Epoch ms captured at the top of `openDocument`. */
  t0: number;
  /** Epoch ms of the first export. */
  exportedAt: number;
}
export interface DocumentMetrics {
  /** Non-AI findings not dismissed as `tool_false_alarm` at export. */
  defectsBeforeBuild: number;
  /** Sheet question count (target: one round). */
  questionsBatched: number;
  /** exportedAt - t0 in ms (never negative). */
  timeToExportMs: number;
}

export const FALSE_ALARM_REASON = 'tool_false_alarm';

export function computeMetrics(input: MetricsInput): DocumentMetrics {
  let defects = 0;
  for (const f of input.findings) {
    if (f.detector_kind === 'ai') continue;
    const s = input.states[f.id];
    if (s?.status === 'dismissed' && s.reasonCode === FALSE_ALARM_REASON) continue;
    defects++;
  }
  return {
    defectsBeforeBuild: defects,
    questionsBatched: Math.max(0, Math.trunc(input.sheetQuestionCount)),
    timeToExportMs: Math.max(0, input.exportedAt - input.t0),
  };
}
