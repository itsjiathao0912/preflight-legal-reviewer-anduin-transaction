import type { MemoryLabel, Severity } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import { gateInterim, type GateState } from '../src/features/review/gateInterim';

function one(severity: Severity, state: GateState, label: MemoryLabel = 'new') {
  return gateInterim([{ id: 'f1', severity }], { f1: state }, { f1: label });
}

describe('gate-interim', () => {
  it('critical open -> unresolved open', () => {
    expect(one('critical', { status: 'open' })).toEqual({
      status: 'blocked',
      reasons: [{ findingKey: 'f1', kind: 'open', link: '#findings/f1' }],
    });
  });
  it('should keep the gate Blocked after Accept on a critical finding', () => {
    expect(one('critical', { status: 'accepted' }).reasons[0]?.kind).toBe('unanswered');
  });
  it('critical needs-counsel -> awaiting_counsel', () => {
    expect(one('critical', { status: 'counsel' }).reasons[0]?.kind).toBe('awaiting_counsel');
  });
  it('critical dismissed with reason -> resolved', () => {
    expect(one('critical', { status: 'dismissed', reasonCode: 'tool_false_alarm' })).toEqual({
      status: 'ready',
      reasons: [],
    });
  });
  it('critical dismissed_reconfirm -> reconfirm_required', () => {
    expect(one('critical', { status: 'open' }, 'dismissed_reconfirm').reasons[0]?.kind).toBe(
      'reconfirm_required',
    );
  });
  it('re-confirming (dismiss with reason) a dismissed_reconfirm item resolves it', () => {
    expect(
      one('critical', { status: 'dismissed', reasonCode: 'other' }, 'dismissed_reconfirm').status,
    ).toBe('ready');
  });
  it('should treat a counsel answer on a reconfirm item as resolved', () => {
    for (const a of ['A', 'B', 'C'] as const) {
      expect(
        one('critical', { status: 'open', counselAnswer: a }, 'dismissed_reconfirm').status,
      ).toBe('ready');
    }
  });
  it('counsel answer unclear on a reconfirm item stays unresolved (unclear)', () => {
    expect(
      one('critical', { status: 'open', counselAnswer: 'unclear' }, 'dismissed_reconfirm')
        .reasons[0]?.kind,
    ).toBe('unclear');
  });
  it('accepted + counsel answer A resolves; prior already_answered resolves; prior awaiting_counsel blocks', () => {
    expect(one('critical', { status: 'accepted', counselAnswer: 'A' }).status).toBe('ready');
    expect(one('critical', { status: 'open' }, 'already_answered').status).toBe('ready');
    expect(one('critical', { status: 'open' }, 'awaiting_counsel').reasons[0]?.kind).toBe(
      'awaiting_counsel',
    );
  });
  it('non-critical never blocks', () => {
    for (const s of ['high', 'medium', 'low'] as const) {
      for (const st of ['open', 'accepted', 'counsel'] as const)
        expect(one(s, { status: st }, 'dismissed_reconfirm').status).toBe('ready');
    }
  });
  it('counts one reason per unresolved critical finding', () => {
    const r = gateInterim(
      [
        { id: 'a', severity: 'critical' },
        { id: 'b', severity: 'critical' },
        { id: 'c', severity: 'high' },
      ],
      { a: { status: 'accepted' }, b: { status: 'dismissed', reasonCode: 'other' } },
      {},
    );
    expect(r.reasons.map((x) => x.findingKey)).toEqual(['a']);
  });
});
