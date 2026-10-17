import { describe, expect, it } from 'vitest';
import { computeMetrics } from '../../../src/index';

describe('metrics', () => {
  it('computes AC64 definitions', () => {
    const m = computeMetrics({
      findings: [
        { id: 'a' },
        { id: 'b', detector_kind: 'rule' },
        { id: 'c', detector_kind: 'ai' },
        { id: 'd' },
        { id: 'e' },
      ],
      states: {
        b: { status: 'dismissed', reasonCode: 'tool_false_alarm' },
        d: { status: 'dismissed', reasonCode: 'intended_by_counsel' },
        e: { status: 'accepted' },
      },
      sheetQuestionCount: 3,
      t0: 1_000,
      exportedAt: 61_000,
    });
    expect(m).toEqual({ defectsBeforeBuild: 3, questionsBatched: 3, timeToExportMs: 60_000 });
  });
  it('never returns negative time or counts', () => {
    const m = computeMetrics({
      findings: [],
      states: {},
      sheetQuestionCount: -2,
      t0: 5,
      exportedAt: 1,
    });
    expect(m).toEqual({ defectsBeforeBuild: 0, questionsBatched: 0, timeToExportMs: 0 });
  });
});
