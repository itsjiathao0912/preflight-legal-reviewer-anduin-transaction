import { describe, expect, it } from 'vitest';
import { computeGate, MEMORY_LABELS, SEVERITIES, type CounselOption } from '../../src/index';
import type {
  GateFinding,
  GateState,
  TriageStatus,
  VarianceGatePolicy,
} from '../../src/counsel/types';

/**
 * AC-V17 (core): `computeGate` with `policy` undefined is byte-equal to the legacy 3-argument call
 * on every one of the 2400 `gate-state-matrix` cells (that file runs 2406 tests: 2400 cells + 6
 * named cases). With the variance policy on: untriaged change findings, regression findings and
 * asked-but-unanswered questions gate; `gates` and `ownerAnswers` semantics are pinned; AI never
 * gates; the gate stays two states.
 */
const STATUSES: TriageStatus[] = ['open', 'accepted', 'counsel', 'dismissed'];
const ANSWERS: (CounselOption | null)[] = [null, 'A', 'B', 'C', 'unclear'];
const KINDS = [undefined, 'rule', 'ai'] as const;
const REASON_CODES = [null, 'tool_false_alarm'] as const;
const ON: VarianceGatePolicy = {
  untriaged_change_blocks: true,
  asked_unanswered_blocks: true,
  regression_blocks: true,
};

describe('variance-gate-state-matrix', () => {
  it('should equal the legacy gate with policy undefined on all 2400 matrix cells', () => {
    let cells = 0;
    for (const status of STATUSES)
      for (const answer of ANSWERS)
        for (const reasonCode of REASON_CODES)
          for (const label of MEMORY_LABELS)
            for (const severity of SEVERITIES)
              for (const kind of KINDS) {
                cells++;
                const f: GateFinding[] = [
                  { id: 'f1', severity, ...(kind ? { detector_kind: kind } : {}) },
                ];
                const s = { f1: { status, counselAnswer: answer, reasonCode } as GateState };
                const legacy = computeGate(f, s, { f1: label });
                expect(JSON.stringify(computeGate(f, s, { f1: label }, undefined))).toBe(
                  JSON.stringify(legacy),
                );
                // `gates` is ignored without a policy (legacy isGating)
                const withGates = computeGate([{ ...f[0]!, gates: true }], s, { f1: label });
                expect(JSON.stringify(withGates)).toBe(JSON.stringify(legacy));
              }
    expect(cells).toBe(2400);
  });

  const change = (id = 'c1', extra: Partial<GateFinding> = {}): GateFinding => ({
    id,
    severity: 'medium',
    detector_kind: 'rule',
    gates: true,
    ...extra,
  });
  const regression = (id = 'r1'): GateFinding => ({
    id,
    severity: 'critical',
    detector_kind: 'rule',
    gates: true,
  });

  it('should block an untriaged change of any severity and resolve it when marked expected', () => {
    expect(computeGate([change()], {}, {}, ON)).toEqual({
      status: 'blocked',
      reasons: [{ findingKey: 'c1', kind: 'open', link: '#findings/c1' }],
    });
    const expectedWithReason = { c1: { status: 'dismissed', reasonCode: 'expected_change' } };
    expect(computeGate([change()], expectedWithReason as never, {}, ON).status).toBe('ready');
    // marked expected without a reason stays open
    expect(computeGate([change()], { c1: { status: 'dismissed' } }, {}, ON).reasons[0]!.kind).toBe(
      'open',
    );
  });

  it('should keep a change blocked until every asked owner answers A/B/C', () => {
    const asked = (o: GateState['ownerAnswers']): Record<string, GateState> => ({
      c1: { status: 'counsel', ownerAnswers: o },
    });
    const one = computeGate([change()], asked({ counsel: null }), {}, ON);
    expect(one.reasons).toEqual([
      { findingKey: 'c1', kind: 'awaiting_counsel', link: '#findings/c1', owner: 'counsel' },
    ]);
    const two = computeGate([change()], asked({ gp: 'A', counsel: null }), {}, ON);
    expect(two.reasons.map((r) => [r.owner, r.kind])).toEqual([['counsel', 'awaiting_counsel']]);
    const both = computeGate([change()], asked({ gp: 'A', counsel: 'B' }), {}, ON);
    expect(both).toEqual({ status: 'ready', reasons: [] });
    const unclear = computeGate([change()], asked({ gp: 'unclear', counsel: 'C' }), {}, ON);
    expect(unclear.reasons.map((r) => [r.owner, r.kind])).toEqual([['gp', 'unclear']]);
    const none = computeGate([change()], asked({ counsel: null, gp: null }), {}, ON);
    expect(none.reasons.map((r) => r.owner)).toEqual(['counsel', 'gp']);
    expect(none.status).toBe('blocked');
  });

  it('treats a missing ownerAnswers key as not asked (empty map = legacy reason mapping)', () => {
    const r = computeGate([change()], { c1: { status: 'counsel', ownerAnswers: {} } }, {}, ON);
    expect(r.reasons).toEqual([
      { findingKey: 'c1', kind: 'awaiting_counsel', link: '#findings/c1' },
    ]);
  });

  it('should gate a regression finding and honour regression_blocks', () => {
    expect(computeGate([regression()], {}, {}, ON).status).toBe('blocked');
    const off = { ...ON, regression_blocks: false };
    expect(computeGate([regression()], {}, {}, off).status).toBe('ready');
    // asked and unanswered still blocks when regression_blocks is off
    const asked = { r1: { status: 'counsel', ownerAnswers: { counsel: null } } } as Record<
      string,
      GateState
    >;
    expect(computeGate([regression()], asked, {}, off).status).toBe('blocked');
  });

  it('should honour untriaged_change_blocks while asked-unanswered still blocks', () => {
    const off = { ...ON, untriaged_change_blocks: false };
    expect(computeGate([change()], {}, {}, off).status).toBe('ready');
    expect(computeGate([change()], { c1: { status: 'accepted' } }, {}, off).reasons[0]!.kind).toBe(
      'unanswered',
    );
  });

  it('should gate an asked-unanswered error finding of any severity, only with the policy on', () => {
    const err: GateFinding = { id: 'e1', severity: 'low', detector_kind: 'rule' };
    const st = { e1: { status: 'accepted' } } as Record<string, GateState>;
    expect(computeGate([err], st, {}).status).toBe('ready');
    expect(computeGate([err], st, {}, ON).reasons).toEqual([
      { findingKey: 'e1', kind: 'unanswered', link: '#findings/e1' },
    ]);
    expect(computeGate([err], st, {}, { ...ON, asked_unanswered_blocks: false }).status).toBe(
      'ready',
    );
    // an untriaged low error finding never gates (legacy critical-only rule)
    expect(computeGate([err], {}, {}, ON).status).toBe('ready');
  });

  it('should never gate an AI finding, even when asked or marked gating', () => {
    const ai: GateFinding = { id: 'a1', severity: 'high', detector_kind: 'ai', gates: true };
    const st = { a1: { status: 'counsel', ownerAnswers: { counsel: null } } } as Record<
      string,
      GateState
    >;
    expect(computeGate([ai], st, {}, ON)).toEqual({ status: 'ready', reasons: [] });
  });

  it('should stay exactly two states over a policy-on state sweep', () => {
    const owners = [undefined, {}, { counsel: null }, { counsel: 'A' }, { gp: 'unclear' }] as const;
    for (const status of STATUSES)
      for (const answer of ANSWERS)
        for (const oa of owners)
          for (const f of [change(), regression(), { id: 'c1', severity: 'low' as const }]) {
            const st: GateState = {
              status,
              counselAnswer: answer,
              ...(oa ? { ownerAnswers: oa as GateState['ownerAnswers'] } : {}),
            };
            const r = computeGate([f], { [f.id]: st }, {}, ON);
            expect(['ready', 'blocked']).toContain(r.status);
            expect(r.status === 'blocked').toBe(r.reasons.length > 0);
          }
  });
});
