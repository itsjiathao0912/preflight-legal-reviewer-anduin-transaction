import { describe, expect, it } from 'vitest';
import { DiffResultSchema } from '../../../src/diff/index';
import { diffOk, fixtureSide, sampleSide } from './diff-helpers';

describe('diff-determinism', () => {
  it('should produce identical output across five runs', () => {
    for (const [a, b, mode] of [
      [5, 6, 'version'],
      [3, 4, 'sibling'],
    ] as const) {
      // fresh parses each run: the whole pipeline, not just the diff, must be stable
      const runs = Array.from({ length: 5 }, () =>
        JSON.stringify(diffOk(sampleSide(a), sampleSide(b), mode)),
      );
      for (const x of runs) expect(x).toBe(runs[0]);
    }
    const sib = Array.from({ length: 5 }, () =>
      JSON.stringify(
        diffOk(fixtureSide('sibling-A.html'), fixtureSide('sibling-B.html'), 'sibling'),
      ),
    );
    for (const x of sib) expect(x).toBe(sib[0]);
  });

  it('DiffResult carries no timing field', () => {
    const r = diffOk(sampleSide(5), sampleSide(6));
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
    };
    walk(r);
    for (const k of keys) expect(k).not.toMatch(/^(ms|time|timing|duration|elapsed|started|at)$/i);
    expect(Object.keys(DiffResultSchema.shape)).not.toContain('ms');
    // strict schema: an added timing field is rejected
    expect(DiffResultSchema.safeParse({ ...r, ms: 1 }).success).toBe(false);
  });
});
