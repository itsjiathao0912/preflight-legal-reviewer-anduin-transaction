import { describe, expect, it } from 'vitest';
import type { FindingView } from '../../../engine/types';
import { buildRows, type Triage } from '../model';
import { computeOutcome, simulateStatus, type OutcomeInput } from './outcome';

// AC-13, E3: exact D12 toast strings, gate transitions, question counts, store-shaped simulation.
function f(id: string, extra: Partial<FindingView> = {}): FindingView {
  return {
    id,
    severity: 'high',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const READ = { blocks: [1] };
const POLICY = {
  untriaged_change_blocks: true,
  asked_unanswered_blocks: true,
  regression_blocks: true,
};
const crit = (id: string) => f(id, { severity: 'critical' });
const run = (
  findings: FindingView[],
  triage: Record<string, Triage>,
  input: Omit<OutcomeInput, 'rows' | 'result' | 'policy'> & Partial<Pick<OutcomeInput, 'result'>>,
) =>
  computeOutcome({
    rows: buildRows(findings, null, triage),
    result: READ,
    policy: POLICY,
    ...input,
  });

describe('findings-v2-outcome', () => {
  it('ask-counsel on a blocking row: accepted, question counted, gate still blocked', () => {
    const o = run([crit('a')], {}, { id: 'a', action: 'ask-counsel' });
    expect(o.text).toBe('Sent to counsel · Counsel questions now 1 · Gate still blocked (1)');
    expect(o.questionCount).toBe(1);
    expect(o.gateBefore).toBe('blocked');
    expect(o.gateAfter).toBe('blocked');
  });

  it('ask-counsel on a non-blocking row: an asked question gates (ready to blocked)', () => {
    const o = run([f('a')], {}, { id: 'a', action: 'ask-counsel' });
    expect(o.text).toBe('Sent to counsel · Counsel questions now 1 · Gate now blocked (1)');
  });

  it('close-real-issue on non-blocking accepted does not count as a question', () => {
    const o = run([f('a')], {}, { id: 'a', action: 'close-real-issue' });
    expect(o.text).toBe('Closed as a real issue · Gate now blocked (1)');
    expect(o.questionCount).toBe(0);
  });

  it('close-dismiss: blocked to ready, and still blocked with two blockers', () => {
    expect(
      run([crit('a')], {}, { id: 'a', action: 'close-dismiss', reason: 'tool_false_alarm' }).text,
    ).toBe('Closed · Gate now ready');
    expect(
      run([crit('a'), crit('b')], {}, { id: 'a', action: 'close-dismiss', reason: 'other' }).text,
    ).toBe('Closed · Gate still blocked (1)');
  });

  it('move-back: ready to blocked', () => {
    const o = run(
      [crit('a')],
      { a: { status: 'dismissed', reasonCode: 'other' } },
      { id: 'a', action: 'move-back' },
    );
    expect(o.text).toBe('Moved back to review · Counsel questions now 0 · Gate now blocked (1)');
    expect(o.gateBefore).toBe('ready');
    expect(o.gateReasons).toBe(1);
  });

  it('close-dismiss on a non-blocking row: ready and ready', () => {
    expect(
      run([f('a'), f('b')], {}, { id: 'a', action: 'close-dismiss', reason: 'no_form_impact' })
        .text,
    ).toBe('Closed · Gate ready');
  });

  it('unreadable document', () => {
    const o = run(
      [f('a')],
      {},
      { id: 'a', action: 'close-dismiss', reason: 'other', result: { blocks: [] } },
    );
    expect(o.text).toBe('Closed · Gate not ready (no text read)');
    expect(o.unreadable).toBe(true);
  });

  it('simulateStatus mirrors the store triage shapes', () => {
    const rows = buildRows(
      [f('x'), f('c', { kind: 'change', severity: 'medium' }), crit('b')],
      null,
      {
        x: { status: 'counsel', ownerAnswers: { gp: null }, note: 'n' },
        b: { status: 'open', decisionId: 'd1' },
      },
    );
    const dis = simulateStatus(rows, { id: 'x', action: 'close-dismiss', reason: 'other' });
    expect(dis[0]!.triage).toEqual({ status: 'dismissed', reasonCode: 'other' });
    expect(dis[0]!.status).toBe('dismissed');
    expect(simulateStatus(rows, { id: 'x', action: 'move-back' })[0]!.triage).toEqual({
      status: 'open',
    });
    const ask = simulateStatus(rows, {
      id: 'c',
      action: 'ask-counsel',
      ask: { owners: ['gp', 'counsel'], source: 'suggested' },
    });
    expect(ask[1]!.triage).toEqual({
      status: 'counsel',
      ownerAnswers: { gp: null, counsel: null },
      ownerSource: 'suggested',
    });
    const acc = simulateStatus(rows, { id: 'b', action: 'ask-counsel' });
    expect(acc[2]!.triage).toEqual({ status: 'accepted', decisionId: 'd1' });
    expect(rows[2]!.status).toBe('open'); // input untouched
    expect(acc[0]).toBe(rows[0]);
  });
});
