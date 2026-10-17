import { describe, expect, it } from 'vitest';
import type { CounselOption, GateReason, Owner } from '@aduin/core';
import type { FindingView } from '../src/engine/types';
import { buildRows, placement, type Triage } from '../src/features/review/model';
import type { MemoryResult } from '../src/memory/fingerprintFindings';
import {
  distinctFindingKeys,
  GATE_GROUP_ORDER,
  gateGroups,
  ownerCounts,
  questionItems,
} from '../src/features/variance/owner-groups';
import { mergeFindings, reviewCounts, reviewGate } from '../src/features/variance/select';

// Variance Phase 04 (F1, H6, "counts agree"): the Findings segment, the Questions tabs, the sidebar
// badge and the gate popover groups all derive from one row list and one gate. Core gate reasons
// are per (finding, owner) pair, so the owner groups sum to gate.reasons.length.
const POLICY = {
  untriaged_change_blocks: true,
  asked_unanswered_blocks: true,
  regression_blocks: true,
};

function fv(id: string, severity: FindingView['severity'], extra: Partial<FindingView> = {}) {
  return {
    id,
    severity,
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    section_path: [],
    quote: `quote ${id}`,
    quote_snippet: 'q',
    quote_hash: 'a'.repeat(64),
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
const change = (id: string, extra: Partial<FindingView> = {}) =>
  fv(id, 'medium', {
    kind: 'change',
    issue_class: 'version_drift',
    detector_id: 'variance.x',
    ...extra,
  });
const asked = (oa: Partial<Record<Owner, CounselOption | null>>): Triage => ({
  status: 'counsel',
  ownerAnswers: oa,
});

const ERRORS = [
  fv('e1', 'critical'), // unasked document error -> You (Document errors)
  fv('e2', 'high'), // Needs counsel, no answer -> Counsel
  fv('e4', 'critical'), // prior-fund item (awaiting counsel elsewhere) -> Earlier funds
  fv('ai1', 'critical', { detector_kind: 'ai' }), // AI never gates
];
const CHANGES = [
  change('c1'), // untriaged change -> You
  change('c2'), // GP + Counsel asked, both open -> GP and Counsel
  change('c3'), // Fund admin answered unclear -> Fund admin (stays blocking)
  change('c4'), // Counsel answered A -> resolved
  change('c5'), // GP answered A, Counsel open -> Counsel only (awaiting_counsel)
  change('r1', { severity: 'critical', pattern_key: 'VAR-REG-SCOPE-EXISTS' }), // regression -> Earlier funds
];
const TRIAGE: Record<string, Triage> = {
  e2: { status: 'counsel' },
  c2: asked({ gp: null, counsel: null }),
  c3: asked({ fund_admin: 'unclear' }),
  c4: asked({ counsel: 'A' }),
  c5: asked({ gp: 'A', counsel: null }),
};
const MEMORY: MemoryResult = {
  byId: { e4: { fingerprint: 'f'.repeat(64), label: 'awaiting_counsel', prior: null } },
  applied: true,
  unavailable: false,
};

function build(policy: typeof POLICY | undefined, triage = TRIAGE) {
  const rows = buildRows(mergeFindings(ERRORS, CHANGES), MEMORY, triage);
  const { main } = placement(rows);
  const gate = reviewGate(rows, { blocks: [1] }, policy);
  const counts = reviewCounts(rows, main, gate);
  return { rows, gate, counts, groups: gateGroups(gate.reasons, rows) };
}

const pairs = (rs: readonly GateReason[]) => rs.map((r) => `${r.findingKey}|${r.owner ?? ''}`);

describe('variance-counts-owner-selector', () => {
  it('should derive Findings segment, Questions tabs, sidebar badge and popover groups from one selector and sum the owner groups to gate.reasons.length', () => {
    const v = build(POLICY);
    const sizes = GATE_GROUP_ORDER.map((id) => v.groups[id].length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(v.gate.reasons.length);
    expect(v.counts.blocked).toBe(v.gate.reasons.length);
    // membership
    const ids = (g: keyof typeof v.groups) => v.groups[g].map((x) => x.reason.findingKey).sort();
    expect(ids('you')).toEqual(['c1', 'e1']);
    expect(v.groups.you.find((x) => x.reason.findingKey === 'e1')?.documentError).toBe(true);
    expect(ids('counsel')).toEqual(['c2', 'c5', 'e2']);
    expect(ids('gp')).toEqual(['c2']);
    expect(ids('fund_admin')).toEqual(['c3']);
    expect(ids('earlier')).toEqual(['e4', 'r1']);
    // "unclear" stays blocking; one-of-two answered keeps the other owner waiting
    expect(v.groups.fund_admin[0]!.reason.kind).toBe('unclear');
    expect(v.groups.counsel.find((x) => x.reason.findingKey === 'c5')!.reason.kind).toBe(
      'awaiting_counsel',
    );
    // distinct finding keys across groups == distinct keys of the core reasons; no pair twice
    const groupKeys = new Set(
      GATE_GROUP_ORDER.flatMap((id) => v.groups[id].map((x) => x.reason.findingKey)),
    );
    expect(groupKeys).toEqual(distinctFindingKeys(v.gate.reasons));
    const all = GATE_GROUP_ORDER.flatMap((id) => pairs(v.groups[id].map((x) => x.reason)));
    expect(new Set(all).size).toBe(all.length);
    // Questions tabs == popover owner groups (every asked question gates under the variance policy)
    expect(v.counts.owners).toEqual({ counsel: 3, gp: 1, fund_admin: 1 });
    expect(ownerCounts(questionItems(v.rows))).toEqual(v.counts.owners);
    for (const o of ['counsel', 'gp', 'fund_admin'] as const)
      expect(v.groups[o].length).toBe(v.counts.owners[o]);
    // sidebar badge: Needs-counsel errors + one per asked owner of change findings
    expect(v.counts.counsel).toBe(1 + 2 + 1 + 1 + 2);
  });

  it('with an Intake package block reason present, the owner groups still sum to the core reasons only', () => {
    const v = build(POLICY);
    const pkg: GateReason = { findingKey: 'pkg:lpa', kind: 'open', link: '#package' };
    const merged = [...v.gate.reasons, pkg];
    // GateButton's merged badge counts the package reason; the groups never do
    expect(merged.length).toBe(v.gate.reasons.length + 1);
    const g = gateGroups(v.gate.reasons, v.rows);
    const sum = GATE_GROUP_ORDER.reduce((n, id) => n + g[id].length, 0);
    expect(sum).toBe(v.gate.reasons.length);
    expect(
      GATE_GROUP_ORDER.some((id) => g[id].some((x) => x.reason.findingKey === 'pkg:lpa')),
    ).toBe(false);
  });

  it('legacy gate (no baseline): a non-critical asked error question is in the tab but not in the popover', () => {
    const rows = buildRows(ERRORS, MEMORY, { e2: { status: 'counsel' } });
    const gate = reviewGate(rows, { blocks: [1] }, undefined);
    const g = gateGroups(gate.reasons, rows);
    expect(ownerCounts(questionItems(rows)).counsel).toBe(1);
    expect(g.counsel.length).toBe(0);
    const sum = GATE_GROUP_ORDER.reduce((n, id) => n + g[id].length, 0);
    expect(sum).toBe(gate.reasons.length);
  });

  it('answering every asked owner clears their pairs (two states only)', () => {
    const v = build(POLICY, {
      ...TRIAGE,
      c2: asked({ gp: 'B', counsel: 'A' }),
      c3: asked({ fund_admin: 'C' }),
      c5: asked({ gp: 'A', counsel: 'A' }),
      e2: { status: 'counsel', counselAnswer: 'A' },
    });
    expect(v.groups.gp).toEqual([]);
    expect(v.groups.fund_admin).toEqual([]);
    expect(v.groups.counsel).toEqual([]);
    expect(v.gate.status).toBe('blocked');
    expect(['ready', 'blocked']).toContain(v.gate.status);
  });
});
