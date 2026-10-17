import { describe, expect, it } from 'vitest';
import { computeGate, MEMORY_LABELS, SEVERITIES, type CounselOption } from '../../../src/index';
import type { GateReasonKind, GateState, TriageStatus } from '../../../src/counsel/types';

const STATUSES: TriageStatus[] = ['open', 'accepted', 'counsel', 'dismissed'];
const ANSWERS: (CounselOption | null)[] = [null, 'A', 'B', 'C', 'unclear'];
const KINDS = [undefined, 'rule', 'ai'] as const;
const REASON_CODES = [null, 'tool_false_alarm'] as const;

/** Spec oracle written from AC22 / D-2 / L4 independently of the implementation. */
function expected(
  status: TriageStatus,
  answer: CounselOption | null,
  reasonCode: string | null,
  label: string,
  severity: string,
  kind: string | undefined,
): GateReasonKind | null {
  if (severity !== 'critical' || kind === 'ai') return null;
  if (answer && answer !== 'unclear') return null; // D-2: clear answer resolves (incl. reconfirm)
  if (answer === 'unclear') return 'unclear';
  if (status === 'dismissed') return reasonCode ? null : 'open';
  if (status === 'accepted') return 'unanswered'; // AC22: Accept alone stays Blocked
  if (status === 'counsel') return 'awaiting_counsel';
  return (
    {
      new: 'open',
      previously_dismissed: 'open',
      dismissed_reconfirm: 'reconfirm_required',
      already_answered: null,
      awaiting_counsel: 'awaiting_counsel',
    } as Record<string, GateReasonKind | null>
  )[label]!;
}

describe('gate-state-matrix', () => {
  let cells = 0;
  for (const status of STATUSES)
    for (const answer of ANSWERS)
      for (const reasonCode of REASON_CODES)
        for (const label of MEMORY_LABELS)
          for (const severity of SEVERITIES)
            for (const kind of KINDS) {
              cells++;
              const name = `${status}/${answer}/${reasonCode}/${label}/${severity}/${kind}`;
              it(name, () => {
                const state: GateState = { status, counselAnswer: answer, reasonCode };
                const r = computeGate(
                  [{ id: 'f1', severity, ...(kind ? { detector_kind: kind } : {}) }],
                  { f1: state },
                  { f1: label },
                );
                const want = expected(status, answer, reasonCode, label, severity, kind);
                expect(r.status).toBe(want ? 'blocked' : 'ready');
                expect(r.reasons).toEqual(
                  want ? [{ findingKey: 'f1', kind: want, link: '#findings/f1' }] : [],
                );
              });
            }
  it('covers the full matrix', () => {
    expect(cells).toBe(4 * 5 * 2 * 5 * 4 * 3);
  });

  it('should block the gate after Accept on a critical finding until counsel answers', () => {
    const f = [{ id: 'x', severity: 'critical' as const }];
    expect(computeGate(f, { x: { status: 'accepted' } }, {}).status).toBe('blocked');
    expect(computeGate(f, { x: { status: 'accepted', counselAnswer: 'B' } }, {}).status).toBe(
      'ready',
    );
  });
  it('should keep the gate blocked for an unclear answer', () => {
    const r = computeGate(
      [{ id: 'x', severity: 'critical' }],
      { x: { status: 'accepted', counselAnswer: 'unclear' } },
      {},
    );
    expect(r.reasons[0]?.kind).toBe('unclear');
  });
  it('should never gate on an AI-detector finding', () => {
    const r = computeGate([{ id: 'x', severity: 'critical', detector_kind: 'ai' }], {}, {});
    expect(r).toEqual({ status: 'ready', reasons: [] });
  });
  it('should show high dismissed_reconfirm label without gating', () => {
    const r = computeGate([{ id: 'x', severity: 'high' }], {}, { x: 'dismissed_reconfirm' });
    expect(r.status).toBe('ready');
  });
  it('defaults missing state to open and missing label to new; keeps finding order', () => {
    const r = computeGate(
      [
        { id: 'b', severity: 'critical' },
        { id: 'a', severity: 'critical' },
      ],
      {},
      {},
    );
    expect(r.reasons.map((x) => x.findingKey)).toEqual(['b', 'a']);
    expect(computeGate([], {}, {})).toEqual({ status: 'ready', reasons: [] });
  });
});
