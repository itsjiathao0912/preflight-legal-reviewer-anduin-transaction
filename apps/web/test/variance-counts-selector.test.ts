import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { CosmeticGroup } from '@aduin/core';
import type { FindingView } from '../src/engine/types';

// Variance Phase 02: ONE selector feeds the Findings segment, header counts, sidebar badge, the gate
// popover input and the dismiss / answer toasts (C2b: toasts never say Ready while the pill is Blocked).
vi.mock('../src/api/client', () => ({ memoryApi: () => null, isRealMemoryApi: () => false }));
vi.mock('../src/features/ai/ai-lane', () => ({
  aiBeginOpen: () => undefined,
  aiHolds: () => false,
  aiReopen: () => null,
  aiOnOpen: async () => ({ findings: [], fresh: false }),
  aiRunFresh: async () => undefined,
  setAiSink: () => undefined,
}));

const { buildRows, placement } = await import('../src/features/review/model');
const sel = await import('../src/features/variance/select');
const { useReview } = await import('../src/state/review');

const POLICY = {
  untriaged_change_blocks: true,
  asked_unanswered_blocks: true,
  regression_blocks: true,
};

function fv(
  id: string,
  severity: FindingView['severity'],
  extra: Partial<FindingView> = {},
): FindingView {
  return {
    id,
    severity,
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: 'abc',
    quote_snippet: 'abc',
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    confidence: 1,
    classLabel: 'Cross-reference',
    title: id,
    ref: '',
    loc: '',
    found: null,
    sensitive: [],
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const change = (id: string) =>
  fv(id, 'medium', { kind: 'change', issue_class: 'version_drift', detector_id: 'VAR-x' });

const ERRORS = [
  fv('e1', 'critical'),
  fv('e2', 'high'),
  fv('e3', 'medium'),
  fv('ai1', 'critical', { detector_kind: 'ai' }),
];
const CHANGES = [change('c1'), change('c2'), change('c3')];

function view(errors: FindingView[], changes: FindingView[], triage = {}, policy?: typeof POLICY) {
  const rows = buildRows(sel.mergeFindings(errors, changes), null, triage);
  const { main } = placement(rows);
  const gate = sel.reviewGate(rows, { blocks: [1] }, policy);
  return { rows, main, gate, counts: sel.reviewCounts(rows, main, gate) };
}

describe('variance-counts-selector', () => {
  it('should derive segment, header, sidebar, popover and toast counts from one selector', () => {
    const triage = {
      e3: { status: 'dismissed' as const, reasonCode: 'tool_false_alarm' as const },
      c2: { status: 'counsel' as const },
    };
    const v = view(ERRORS, CHANGES, triage, POLICY);
    // change rows never inflate the severity chips or Errors N
    expect(v.counts.chips).toEqual({ block: 2, fix: 1, note: 0 });
    expect(v.counts.errors).toBe(3);
    expect(v.counts.changes).toBe(3);
    // sidebar badge = open errors + open changes (one list)
    expect(v.counts.errorsOpen).toBe(3);
    expect(v.counts.changesOpen).toBe(2);
    expect(v.counts.open).toBe(5);
    expect(v.counts.counsel).toBe(1);
    // gate: critical rule error + untriaged changes + asked unanswered change; AI never gates
    const keys = v.gate.reasons.map((r) => r.findingKey).sort();
    expect(keys).toEqual(['c1', 'c2', 'c3', 'e1']);
    expect(v.counts.blocked).toBe(4);
    // toasts read the same gate
    expect(sel.gateLineText(v.gate)).toBe('4 items left on the gate.');
    expect(sel.dismissGateText(v.gate)).toBe('4 blocking reasons left.');
  });

  it('without a baseline the gate and header are exactly the legacy ones', () => {
    const v = view(ERRORS, [], {}, undefined);
    expect(v.gate.reasons.map((r) => r.findingKey)).toEqual(['e1']);
    expect(v.counts.chips).toEqual({ block: 2, fix: 1, note: 1 });
    // change rows without the policy never gate (policy only when a baseline resolved)
    const noPolicy = view(ERRORS, CHANGES, {}, undefined);
    expect(noPolicy.gate.reasons.map((r) => r.findingKey)).toEqual(['e1']);
  });

  it('an unreadable document never reads Ready in the toasts', () => {
    const rows = buildRows([], null, {});
    const gate = sel.reviewGate(rows, { blocks: [] }, undefined);
    expect(gate.unreadable).toBe(true);
    expect(sel.gateLineText(gate)).not.toContain('Ready.');
    expect(sel.dismissGateText(gate)).not.toContain('Ready.');
  });

  it('caps cosmetic groups at 5 in core order with an overflow line', () => {
    const g = (i: number, count: number): CosmeticGroup => ({
      ruleId: 'VAR-COS-FORMAT',
      key: `k${i}`,
      label: `G${i}`,
      count,
      examples: [],
    });
    const groups = [g(1, 5), g(2, 4), g(3, 6), g(4, 3), g(5, 28), g(6, 4), g(7, 15), g(8, 13)];
    const c = sel.capCosmeticGroups(groups, 5);
    expect(c.shown.map((x) => x.key)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
    expect(c.moreGroups).toBe(3);
    expect(c.moreChanges).toBe(32);
    expect(sel.moreGroupsLine(c)).toBe('+3 more groups (32 changes)');
    expect(sel.moreGroupsLine(sel.capCosmeticGroups(groups.slice(0, 5)))).toBeNull();
  });

  it('the dismiss toast in state/review.ts agrees with the shared gate for the same rows', async () => {
    sel.setVarianceSource(() => ({ findings: CHANGES, policy: POLICY }));
    useReview.setState({
      phase: 'ready',
      doc: {
        id: 'doc-1',
        name: 'x',
        firmId: null,
        firmName: '',
        fund: 'F',
        version: 'v',
        source: 'upload',
        ref: 'up_1',
      },
      result: {
        docHash: 'doc-1',
        bytes: 1,
        blocks: [{ id: 'b0', kind: 'paragraph', text: 'abc', section: null }],
        sections: [],
        findings: ERRORS,
        stages: [],
        failedStage: null,
      },
      memory: null,
      triage: {},
    });
    await useReview.getState().dismiss('e1', 'tool_false_alarm', '');
    const rows = buildRows(sel.mergeFindings(ERRORS, CHANGES), null, useReview.getState().triage);
    const gate = sel.reviewGate(rows, useReview.getState().result, POLICY);
    expect(gate.reasons.length).toBe(3);
    expect(useReview.getState().toast?.msg).toBe(
      `Dismissed. ${sel.dismissGateText(gate)} Saved for this document only. Pick a law firm to remember this decision.`,
    );
    expect(useReview.getState().toast?.msg).not.toContain('Ready');
    // dismissing a change row writes local triage only and still agrees
    await useReview.getState().dismiss('c1', 'tool_false_alarm', '');
    expect(useReview.getState().triage['c1']?.status).toBe('dismissed');
    expect(useReview.getState().triage['c1']?.decisionId ?? null).toBeNull();
    expect(useReview.getState().toast?.msg).toBe(
      'Dismissed. 2 blocking reasons left. Saved for this document only. Pick a law firm to remember this decision.',
    );
    sel.setVarianceSource(() => ({ findings: [], policy: undefined }));
  });
});
