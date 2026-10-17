import type { ActiveDecision, AuditEvent, Rule } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import {
  auditForDisplay,
  auditGroup,
  filterAudit,
  joinRevoked,
  matchingDismissals,
  ruleWhoWhen,
} from '../src/features/memory/memory-join';

const FP = 'a'.repeat(64);
const FIRM = 'partners-group';

function dec(id: string, over: Partial<ActiveDecision> = {}): ActiveDecision {
  return {
    id,
    fingerprint: FP,
    status: 'active',
    decision: 'dismissed',
    reason_code: 'firm_standard_wording',
    pattern_key: 'flag-placeholder:insert',
    issue_class: 'placeholder',
    fund_name: 'Fund',
    decided_by_name: 'Avery',
    decided_at: 1,
    ...over,
  };
}

function ev(id: string, action: AuditEvent['action'], over: Partial<AuditEvent> = {}): AuditEvent {
  return { id, at: 100, actor_name: 'Linh Tran', action, law_firm_id: FIRM, ...over };
}

const rule = (over: Partial<Rule> = {}): Rule => ({
  id: 'sr01',
  text: 'Placeholders on the FFC line are firm standard wording.',
  status: 'proposed',
  origin: 'seed',
  evidence_count: 10,
  ...over,
});

describe('memory-join', () => {
  test('should resolve matching dismissals without equating them to evidence_count', () => {
    // text path: pattern from the generated text + reason from the rule_proposed audit detail
    const decisions = [
      dec('d1'),
      dec('d2'),
      dec('d3', { reason_code: 'no_form_impact' }),
      dec('d4', { pattern_key: 'other:key' }),
    ];
    const generated = rule({
      id: 'fr_1',
      origin: 'proposal',
      evidence_count: 7,
      text: 'Findings matching "flag-placeholder:insert" are usually standard wording for this firm (proposed from repeated dismissals).',
    });
    const proposed = ev('e1', 'rule_proposed', {
      entity_id: 'fr_1',
      detail: { reason_code: 'firm_standard_wording' },
    });
    const t = matchingDismissals(generated, decisions, [proposed]);
    expect(t.via).toBe('text');
    expect(t.decisions.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(t.decisions.length).not.toBe(generated.evidence_count);

    // fallback path (seeded free-text rule): the single 3+ (pattern_key, reason_code) group
    const seeded = [dec('sd01'), dec('sd02'), dec('sd03'), dec('x1', { reason_code: 'other' })];
    const f = matchingDismissals(rule(), seeded, [
      ev('e2', 'rule_proposed', { entity_id: 'sr01', detail: { status: 'proposed' } }),
    ]);
    expect(f.via).toBe('fallback');
    expect(f.patternKey).toBe('flag-placeholder:insert');
    expect(f.reasonCode).toBe('firm_standard_wording');
    expect(f.decisions.map((d) => d.id)).toEqual(['sd01', 'sd02', 'sd03']);
    expect(f.decisions.length).not.toBe(10);

    // unresolved: two 3+ groups (ambiguous) or none
    const two = [
      ...seeded.slice(0, 3),
      dec('n1', { pattern_key: 'k:2' }),
      dec('n2', { pattern_key: 'k:2' }),
      dec('n3', { pattern_key: 'k:2' }),
    ];
    expect(matchingDismissals(rule(), two, []).via).toBe('none');
    expect(matchingDismissals(rule(), two, []).decisions).toEqual([]);
    expect(matchingDismissals(rule(), [dec('a'), dec('b')], []).via).toBe('none');
    // `other` and accepted / revoked decisions never count
    expect(
      matchingDismissals(
        rule(),
        [
          dec('o1', { reason_code: 'other' }),
          dec('o2', { reason_code: 'other' }),
          dec('o3', { reason_code: 'other' }),
          dec('a1', { decision: 'accepted' }),
        ],
        [],
      ).via,
    ).toBe('none');
  });

  test('joinRevoked rebuilds reopened rows with who/when/why from the audit trail', () => {
    const events = [
      ev('r1', 'decision_revoked', {
        at: 300,
        entity_id: 'd9',
        reason: 'Counsel changed their answer',
        detail: { decision: 'dismissed' },
      }),
      ev('c1', 'decision_recorded', {
        at: 100,
        entity_id: 'd9',
        detail: { issue_class: 'defined_term_issue', decision: 'dismissed' },
      }),
      ev('r2', 'decision_revoked', { at: 200, entity_id: 'd8', actor_name: 'Duc Pham' }),
      ev('r3', 'decision_revoked', { at: 250, entity_id: 'dx', law_firm_id: 'firm-x' }),
      ev('r4', 'decision_revoked', { at: 260, entity_id: 'd1' }),
    ];
    const rows = joinRevoked([dec('d1')], events, FIRM);
    expect(rows).toEqual([
      {
        id: 'd9',
        who: 'Linh Tran',
        at: 300,
        reason: 'Counsel changed their answer',
        decision: 'dismissed',
        issueClass: 'defined_term_issue',
      },
      // lean row: no decision_recorded event loaded -> issue class unknown ("—" in the UI)
      { id: 'd8', who: 'Duc Pham', at: 200, reason: null, decision: null, issueClass: null },
    ]);
  });

  test('audit groups and the firm filter (session_created has no firm)', () => {
    expect(auditGroup({ action: 'decision_recorded' })).toBe('decision');
    expect(auditGroup({ action: 'answer_recorded' })).toBe('decision');
    expect(auditGroup({ action: 'decision_revoked' })).toBe('reopen');
    for (const a of [
      'rule_added',
      'rule_proposed',
      'rule_approved',
      'rule_rejected',
      'rule_revoked',
    ] as const)
      expect(auditGroup({ action: a })).toBe('rule');
    expect(auditGroup({ action: 'session_created' })).toBeNull();
    const events = [
      ev('s', 'session_created', { law_firm_id: undefined }),
      ev('a', 'decision_recorded'),
      ev('b', 'decision_revoked'),
      ev('c', 'rule_added'),
      ev('d', 'rule_added', { law_firm_id: 'firm-x' }),
      ev('e', 'counsel_sheet_exported'),
    ];
    expect(filterAudit(events, 'all', FIRM).map((e) => e.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(filterAudit(events, 'decision', FIRM).map((e) => e.id)).toEqual(['a']);
    expect(filterAudit(events, 'reopen', FIRM).map((e) => e.id)).toEqual(['b']);
    expect(filterAudit(events, 'rule', FIRM).map((e) => e.id)).toEqual(['c']);
  });

  test('rule who/when prefers approval, then creation, then proposal', () => {
    const events = [
      ev('1', 'rule_proposed', { entity_id: 'r1', actor_name: 'Rule engine', at: 10 }),
      ev('2', 'rule_approved', { entity_id: 'r1', actor_name: 'Linh Tran', at: 20 }),
      ev('3', 'rule_added', { entity_id: 'r2', actor_name: 'Duc Pham', at: 30 }),
    ];
    expect(ruleWhoWhen({ id: 'r1' }, events)).toEqual({
      who: 'Linh Tran',
      at: 20,
      action: 'rule_approved',
    });
    expect(ruleWhoWhen({ id: 'r2' }, events)?.who).toBe('Duc Pham');
    expect(ruleWhoWhen({ id: 'r3' }, events)).toBeNull();
  });

  test('audit display form: type + short id target, reason or reason_code label', () => {
    const e = auditForDisplay(
      ev('x', 'decision_recorded', {
        entity_type: 'decision',
        entity_id: 'fd_0123456789abcdef',
        detail: { reason_code: 'no_form_impact' },
      }),
    );
    expect(e.entity_type).toBe('decision …abcdef');
    expect(e.reason).toBe('Does not affect the form');
    const r = auditForDisplay(
      ev('y', 'decision_revoked', { entity_type: 'decision', entity_id: 'sd01', reason: 'Why' }),
    );
    expect(r.entity_type).toBe('decision sd01');
    expect(r.reason).toBe('Why');
    expect(auditForDisplay(ev('z', 'session_created')).reason).toBeUndefined();
  });
});
