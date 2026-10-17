import { REASON_CODES } from '@aduin/core';
import { describe, expect, it } from 'vitest';
import type { FindingView } from '../../../engine/types';
import { buildRows, type Row } from '../model';
import { DISMISS_REASON_REQUIRED } from '../reasons';
import { CLOSE_REASONS, closeError, closeReasonsFor, toCloseCall } from './reasons-map';

// AC-3, E24: close-reason keys, labels, Real issue visibility and the note rule.
function row(extra: Partial<FindingView> = {}): Row {
  const f = {
    id: 'f1',
    severity: 'high',
    issue_class: 'broken_cross_reference',
    detector_kind: 'rule',
    detector_id: 'XREF',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: 0, offsetEnd: 3 },
    detail: { explanation: 'x.', facts: {}, interpretations: [] },
    order: 0,
    ...extra,
  } as unknown as FindingView;
  return buildRows([f], null, {})[0]!;
}

describe('findings-v2-reasons-map', () => {
  it('lists the five D2 reasons in order with exact labels', () => {
    expect(CLOSE_REASONS.map((o) => o.key)).toEqual([
      'real_issue',
      'firm_standard_wording',
      'no_form_impact',
      'tool_false_alarm',
      'other',
    ]);
    expect(CLOSE_REASONS.map((o) => o.label)).toEqual([
      "Real issue — I'll handle it in the form build",
      "Firm's standard wording",
      'Does not affect the form',
      'Tool false alarm',
      'Other',
    ]);
  });

  it('every non-synthetic key is a core reason code', () => {
    for (const o of CLOSE_REASONS)
      if (o.key !== 'real_issue') expect(REASON_CODES as readonly string[]).toContain(o.key);
  });

  it('only real_issue is hidden on blocking rows and only Other needs a note', () => {
    expect(CLOSE_REASONS.filter((o) => o.blockingHidden).map((o) => o.key)).toEqual(['real_issue']);
    expect(CLOSE_REASONS.filter((o) => o.noteRequired).map((o) => o.key)).toEqual(['other']);
  });

  it('closeReasonsFor hides real_issue for blocking and change rows, keeps it for a non-blocking rule row', () => {
    expect(closeReasonsFor(row({ severity: 'critical' })).map((o) => o.key)).not.toContain(
      'real_issue',
    );
    expect(
      closeReasonsFor(row({ severity: 'medium', kind: 'change' })).map((o) => o.key),
    ).not.toContain('real_issue');
    const keep = closeReasonsFor(row({ severity: 'high' }));
    expect(keep.map((o) => o.key)).toContain('real_issue');
    expect(keep).toHaveLength(5);
  });

  it('toCloseCall maps real_issue to accept and trims the note for a dismissal', () => {
    expect(toCloseCall('real_issue', '  x ')).toEqual({ call: 'accept' });
    expect(toCloseCall('other', '  why  ')).toEqual({
      call: 'dismiss',
      reason: 'other',
      note: 'why',
    });
    expect(toCloseCall('tool_false_alarm', '')).toEqual({
      call: 'dismiss',
      reason: 'tool_false_alarm',
      note: '',
    });
  });

  it('closeError requires a reason and a non-empty note for Other', () => {
    expect(closeError(null, '')).toBe(DISMISS_REASON_REQUIRED);
    expect(closeError('other', '   ')).toBe('Add a note for "Other".');
    expect(closeError('other', ' a ')).toBeNull();
    expect(closeError('no_form_impact', '')).toBeNull();
    expect(closeError('real_issue', '')).toBeNull();
  });
});
