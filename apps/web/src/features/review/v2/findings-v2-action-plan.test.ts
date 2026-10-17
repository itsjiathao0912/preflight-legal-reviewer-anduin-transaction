import { describe, expect, it } from 'vitest';
import type { FindingView } from '../../../engine/types';
import { buildRows, type Row, type Triage } from '../model';
import { barState, nextToReview, planControl } from './action-plan';

// AC-2, AC-4, E4: control mapping, never a toggle, owner rule, next row, bar state.
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
const one = (fv: FindingView, t?: Triage): Row =>
  buildRows([fv], null, t ? { [fv.id]: t } : {})[0]!;
const block = (t?: Triage) => one(f('b', { severity: 'critical' }), t);
const fix = (t?: Triage) => one(f('x', { severity: 'high' }), t);
const change = (t?: Triage) => one(f('c', { severity: 'medium', kind: 'change' }), t);

describe('findings-v2-action-plan', () => {
  it('ask-counsel: blocking -> accept, non-blocking -> needsCounsel, no selection -> noop', () => {
    expect(planControl('ask-counsel', block())).toEqual({ kind: 'call', call: 'accept', id: 'b' });
    expect(planControl('ask-counsel', fix())).toEqual({
      kind: 'call',
      call: 'needsCounsel',
      id: 'x',
    });
    expect(planControl('ask-counsel', null)).toEqual({ kind: 'noop', reason: 'no-selection' });
  });

  it('never toggles an acted row', () => {
    for (const status of ['counsel', 'accepted', 'dismissed'] as const) {
      expect(planControl('ask-counsel', block({ status }))).toEqual({
        kind: 'noop',
        reason: 'already-acted',
      });
      expect(planControl('close-issue', fix({ status }))).toEqual({
        kind: 'noop',
        reason: 'already-acted',
      });
    }
  });

  it('change rows need owners and carry the ask', () => {
    expect(planControl('ask-counsel', change())).toEqual({
      kind: 'noop',
      reason: 'owner-required',
    });
    expect(
      planControl('ask-counsel', change(), { ask: { owners: [], source: 'override' } }),
    ).toEqual({
      kind: 'noop',
      reason: 'owner-required',
    });
    const ask = { owners: ['gp' as const], source: 'suggested' as const };
    expect(planControl('ask-counsel', change(), { ask })).toEqual({
      kind: 'call',
      call: 'needsCounsel',
      id: 'c',
      ask,
    });
  });

  it('close-issue opens the modal for an open row', () => {
    expect(planControl('close-issue', fix())).toEqual({ kind: 'open-close-modal', id: 'x' });
    expect(planControl('close-issue', null)).toEqual({ kind: 'noop', reason: 'no-selection' });
  });

  it('move-back: open -> not-acted, answered -> noop answered, else restore', () => {
    expect(planControl('move-back', fix())).toEqual({ kind: 'noop', reason: 'not-acted' });
    expect(planControl('move-back', null)).toEqual({ kind: 'noop', reason: 'no-selection' });
    expect(planControl('move-back', fix({ status: 'dismissed' }))).toEqual({
      kind: 'call',
      call: 'restore',
      id: 'x',
    });
    expect(planControl('move-back', block({ status: 'accepted', counselAnswer: 'A' }))).toEqual({
      kind: 'noop',
      reason: 'answered',
    });
    expect(
      planControl('move-back', change({ status: 'counsel', ownerAnswers: { gp: 'B' } })),
    ).toEqual({ kind: 'noop', reason: 'answered' });
    expect(
      planControl('move-back', change({ status: 'counsel', ownerAnswers: { gp: null } })),
    ).toEqual({ kind: 'call', call: 'restore', id: 'c' });
  });

  it('barState labels and enablement', () => {
    expect(barState(null)).toEqual({
      primary: null,
      closeEnabled: false,
      moveBackEnabled: false,
      labels: { ask: 'Ask counsel', close: 'Close issue' },
    });
    expect(barState(fix())).toMatchObject({
      primary: 'ask-counsel',
      closeEnabled: true,
      moveBackEnabled: false,
    });
    expect(barState(fix({ status: 'counsel' }))).toMatchObject({
      primary: 'move-back',
      closeEnabled: false,
      moveBackEnabled: true,
    });
    expect(barState(block({ status: 'accepted', counselAnswer: 'A' })).moveBackEnabled).toBe(false);
    expect(barState(change()).labels).toEqual({ ask: 'Ask owner', close: 'Mark as expected...' });
  });

  it('nextToReview: next, previous, none', () => {
    const rows = buildRows([f('1'), f('2'), f('3')], null, { '2': { status: 'counsel' } });
    const flat = [rows[0]!, rows[2]!, rows[1]!]; // review 1,3 then sent 2
    expect(nextToReview(flat, '1')).toBe('3');
    expect(nextToReview(flat, '3')).toBe('1');
    expect(nextToReview(flat, '2')).toBe('1');
    const solo = buildRows([f('9')], null, {});
    expect(nextToReview(solo, '9')).toBeNull();
    expect(nextToReview([], 'z')).toBeNull();
  });
});
