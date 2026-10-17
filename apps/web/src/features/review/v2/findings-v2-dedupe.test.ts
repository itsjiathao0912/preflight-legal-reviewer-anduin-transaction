import { describe, expect, it } from 'vitest';
import type { FindingView } from '../../../engine/types';
import { dedupeFindings, triageWithTwins } from './dedupe';

// AC-12: rule + AI twin merge rules.
function f(
  id: string,
  kind: 'rule' | 'ai',
  start: number,
  end: number,
  extra: Partial<FindingView> = {},
): FindingView {
  return {
    id,
    severity: 'high',
    issue_class: 'ambiguity',
    detector_kind: kind,
    detector_id: kind === 'rule' ? 'R' : 'ai',
    anchor: { docHash: 'd', blockId: 'b0', offsetStart: start, offsetEnd: end },
    order: 0,
    ...extra,
  } as unknown as FindingView;
}
const ids = (xs: readonly FindingView[]) => xs.map((x) => x.id);

describe('findings-v2-dedupe', () => {
  it('merges an overlapping AI finding into the rule and keeps the rule id', () => {
    const r = dedupeFindings([f('r', 'rule', 0, 10), f('a', 'ai', 5, 15)]);
    expect(ids(r.findings)).toEqual(['r']);
    expect(r.twins.r?.id).toBe('a');
    expect(r.twinOf).toEqual({ a: 'r' });
  });

  it('touching ranges do not match', () => {
    expect(ids(dedupeFindings([f('r', 'rule', 0, 10), f('a', 'ai', 10, 20)]).findings)).toEqual([
      'r',
      'a',
    ]);
  });

  it('class, block and same-kind mismatches never merge', () => {
    expect(
      ids(
        dedupeFindings([
          f('r', 'rule', 0, 10),
          f('a', 'ai', 0, 10, { issue_class: 'typo' } as never),
        ]).findings,
      ),
    ).toHaveLength(2);
    expect(
      ids(
        dedupeFindings([
          f('r', 'rule', 0, 10),
          f('a', 'ai', 0, 10, {
            anchor: { docHash: 'd', blockId: 'b1', offsetStart: 0, offsetEnd: 10 },
          } as never),
        ]).findings,
      ),
    ).toHaveLength(2);
    expect(ids(dedupeFindings([f('r', 'rule', 0, 10), f('s', 'rule', 0, 10)]).findings)).toEqual([
      'r',
      's',
    ]);
    expect(ids(dedupeFindings([f('a', 'ai', 0, 10), f('b', 'ai', 0, 10)]).findings)).toEqual([
      'a',
      'b',
    ]);
  });

  it('change rows are untouched', () => {
    const r = dedupeFindings([f('r', 'rule', 0, 10, { kind: 'change' }), f('a', 'ai', 0, 10)]);
    expect(ids(r.findings)).toEqual(['r', 'a']);
    expect(r.twinOf).toEqual({});
  });

  it('picks the largest overlap, then lowest order, then lowest id; one twin per rule', () => {
    const big = dedupeFindings([f('r', 'rule', 0, 10), f('a', 'ai', 8, 20), f('b', 'ai', 2, 9)]);
    expect(big.twins.r?.id).toBe('b');
    expect(ids(big.findings)).toEqual(['r', 'a']);
    const ord = dedupeFindings([
      f('r', 'rule', 0, 10),
      f('a', 'ai', 0, 5, { order: 2 }),
      f('b', 'ai', 5, 10, { order: 1 }),
    ]);
    expect(ord.twins.r?.id).toBe('b');
    const byId = dedupeFindings([f('r', 'rule', 0, 10), f('z', 'ai', 0, 5), f('m', 'ai', 5, 10)]);
    expect(byId.twins.r?.id).toBe('m');
    expect(ids(byId.findings)).toEqual(['r', 'z']);
  });

  it('rules claim in input order: the first rule wins a shared AI finding', () => {
    const r = dedupeFindings([f('r1', 'rule', 0, 4), f('r2', 'rule', 0, 10), f('a', 'ai', 0, 10)]);
    expect(r.twinOf).toEqual({ a: 'r1' });
    expect(r.twins.r2).toBeUndefined();
    expect(ids(r.findings)).toEqual(['r1', 'r2']);
  });

  it('triageWithTwins falls back to the twin triage only when the primary has none', () => {
    const out = triageWithTwins(
      { a: { status: 'counsel' }, b: { status: 'dismissed' }, s: { status: 'accepted' } },
      { a: 'p', b: 's' },
    );
    expect(out.p).toEqual({ status: 'counsel' });
    expect(out.s).toEqual({ status: 'accepted' });
    expect(Object.keys(out).sort()).toEqual(['a', 'b', 'p', 's']);
    expect(triageWithTwins({}, { a: 'p' })).toEqual({});
  });
});
