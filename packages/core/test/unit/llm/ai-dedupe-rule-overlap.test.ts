// AC10 (ai-review-stream-dedup D3b): dropRuleDuplicates / rangesOverlap.
import { describe, expect, it } from 'vitest';
import { dropRuleDuplicates, rangesOverlap } from '../../../src/llm/dedupe';

const a = (id: string, blockId: string, s: number, e: number, kind = 'ai') => ({
  id,
  detector_kind: kind,
  anchor: { blockId, offsetStart: s, offsetEnd: e },
});

describe('ai-dedupe-rule-overlap (AC10)', () => {
  it('rangesOverlap: half-open, adjacency is not overlap, zero-length normalized', () => {
    expect(rangesOverlap(0, 5, 4, 9)).toBe(true);
    expect(rangesOverlap(0, 5, 5, 9)).toBe(false);
    expect(rangesOverlap(5, 9, 0, 5)).toBe(false);
    expect(rangesOverlap(2, 3, 0, 10)).toBe(true);
    expect(rangesOverlap(3, 3, 3, 3)).toBe(true);
    expect(rangesOverlap(3, 3, 0, 3)).toBe(false);
    expect(rangesOverlap(3, 3, 0, 4)).toBe(true);
  });

  it('rangesOverlap never throws on hostile numbers and treats them as no overlap', () => {
    expect(rangesOverlap(Number.NaN, 5, 0, 5)).toBe(false);
    expect(rangesOverlap(0, Number.POSITIVE_INFINITY, 0, 5)).toBe(false);
    expect(rangesOverlap(-5, -1, -3, 0)).toBe(true);
  });

  it('should drop an AI finding that overlaps a rule anchor in the same block of any class', () => {
    const ai = [a('x', 'b1', 0, 10), a('y', 'b1', 20, 30), a('z', 'b2', 0, 10)];
    const rules = [a('r', 'b1', 5, 8, 'rule')];
    const out = dropRuleDuplicates(ai, rules);
    expect(out.dropped.map((f) => f.id)).toEqual(['x']);
    expect(out.kept.map((f) => f.id)).toEqual(['y', 'z']);
  });

  it('same range in a different block is kept', () => {
    const out = dropRuleDuplicates([a('x', 'b2', 0, 10)], [a('r', 'b1', 0, 10, 'rule')]);
    expect(out.kept).toHaveLength(1);
  });

  it('adjacent ranges are kept; zero-length rule anchor inside drops', () => {
    expect(
      dropRuleDuplicates([a('x', 'b1', 0, 5)], [a('r', 'b1', 5, 9, 'rule')]).kept,
    ).toHaveLength(1);
    expect(
      dropRuleDuplicates([a('x', 'b1', 0, 5)], [a('r', 'b1', 2, 2, 'rule')]).kept,
    ).toHaveLength(0);
  });

  it('AI-vs-AI overlap never drops; non-rule "rules" are ignored', () => {
    const ai = [a('x', 'b1', 0, 10), a('y', 'b1', 0, 10)];
    const out = dropRuleDuplicates(ai, [...ai, a('m', 'b1', 0, 10, 'memory')]);
    expect(out.kept.map((f) => f.id)).toEqual(['x', 'y']);
    expect(out.dropped).toEqual([]);
  });

  it('preserves order and is pure', () => {
    const ai = [a('1', 'b', 50, 60), a('2', 'b', 0, 3), a('3', 'b', 30, 40), a('4', 'b', 2, 4)];
    const rules = [a('r', 'b', 1, 2, 'rule'), a('s', 'b', 55, 56, 'rule')];
    const snapshot = JSON.stringify(ai);
    const out = dropRuleDuplicates(ai, rules);
    expect(out.kept.map((f) => f.id)).toEqual(['3', '4']);
    expect(out.dropped.map((f) => f.id)).toEqual(['1', '2']);
    expect(JSON.stringify(ai)).toBe(snapshot);
  });

  it('hostile anchors never throw', () => {
    const out = dropRuleDuplicates(
      [a('x', 'b', Number.NaN, 3)],
      [a('r', 'b', 0, Number.NaN, 'rule')],
    );
    expect(out.kept).toHaveLength(1);
  });
});
