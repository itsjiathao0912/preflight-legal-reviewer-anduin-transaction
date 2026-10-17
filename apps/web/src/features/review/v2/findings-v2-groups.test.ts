import { describe, expect, it } from 'vitest';
import type { FindingView } from '../../../engine/types';
import { buildRows, type Row, type Triage } from '../model';
import { flatOrder, gatesReview, groupOf, groupRows, isBlocking, progressOf } from './groups';

// AC-9, E24: group rule, stable order, progress and gatesReview.
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

describe('findings-v2-groups', () => {
  it('groups all four statuses for blocking and non-blocking rows', () => {
    const cases: [Triage['status'], string, string][] = [
      ['open', 'review', 'review'],
      ['counsel', 'sent', 'sent'],
      ['accepted', 'sent', 'closed'],
      ['dismissed', 'closed', 'closed'],
    ];
    for (const [status, block, nonBlock] of cases) {
      expect(groupOf(one(f('a', { severity: 'critical' }), { status }))).toBe(block);
      expect(groupOf(one(f('b', { severity: 'high' }), { status }))).toBe(nonBlock);
    }
  });

  it('gatesReview is true for blocking and change rows; isBlocking stays severity-based', () => {
    expect(gatesReview(one(f('a', { severity: 'critical' })))).toBe(true);
    const ch = one(f('c', { severity: 'medium', kind: 'change' }));
    expect(gatesReview(ch)).toBe(true);
    expect(isBlocking(ch)).toBe(false);
    expect(gatesReview(one(f('n', { severity: 'low' })))).toBe(false);
  });

  it('an accepted change row goes to Sent, an accepted non-blocking rule row to Closed', () => {
    expect(
      groupOf(one(f('c', { severity: 'medium', kind: 'change' }), { status: 'accepted' })),
    ).toBe('sent');
    expect(groupOf(one(f('r', { severity: 'medium' }), { status: 'accepted' }))).toBe('closed');
  });

  it('groupRows keeps incoming order and flatOrder concatenates review, sent, closed', () => {
    const rows = buildRows([f('1'), f('2'), f('3'), f('4'), f('5')], null, {
      '2': { status: 'dismissed' },
      '3': { status: 'counsel' },
      '5': { status: 'counsel' },
    });
    const g = groupRows(rows);
    expect(g.review.map((r) => r.f.id)).toEqual(['1', '4']);
    expect(g.sent.map((r) => r.f.id)).toEqual(['3', '5']);
    expect(g.closed.map((r) => r.f.id)).toEqual(['2']);
    expect(flatOrder(g).map((r) => r.f.id)).toEqual(['1', '4', '3', '5', '2']);
  });

  it('progress counts and done', () => {
    const rows = buildRows([f('1'), f('2'), f('3')], null, {
      '2': { status: 'counsel' },
      '3': { status: 'dismissed' },
    });
    expect(progressOf(rows)).toEqual({
      total: 3,
      reviewed: 2,
      sent: 1,
      closed: 1,
      left: 1,
      done: false,
    });
    const all = buildRows([f('1')], null, { '1': { status: 'accepted' } });
    expect(progressOf(all).done).toBe(true);
    expect(progressOf([])).toEqual({
      total: 0,
      reviewed: 0,
      sent: 0,
      closed: 0,
      left: 0,
      done: false,
    });
  });
});
