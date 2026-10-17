import { describe, expect, it } from 'vitest';
import { DiffResultSchema } from '../../../src/diff/index';
import { diffOk, fixtureJson, fixtureSide } from './diff-helpers';

interface SiblingExpect {
  a: string;
  b: string;
  clauses: { common: number; differing: number; only_a: number; only_b: number };
  labels: Array<{ label: string; contains: string }>;
}

/** Expectations are AUTHORED in the fixture generator (fixtures/diff/expected), not engine-derived. */
const exp = fixtureJson<SiblingExpect>('expected/sibling-A-vs-B.json');
const r = diffOk(fixtureSide(exp.a), fixtureSide(exp.b), 'sibling');

describe('sibling-clause-common-vs-differing', () => {
  it('labels every clause and matches the authored counts', () => {
    expect(DiffResultSchema.safeParse(r).success).toBe(true);
    expect(r.mode).toBe('sibling');
    expect(r.summary.clauses).toEqual(exp.clauses);
    expect(r.clauses).toHaveLength(Object.values(exp.clauses).reduce((x, y) => x + y, 0));
  });

  it('should label an unchanged clause common in sibling mode', () => {
    for (const want of exp.labels) {
      const hit = r.clauses!.find((c) => (c.a?.text ?? c.b?.text ?? '').includes(want.contains));
      expect(hit, want.contains).toBeDefined();
      expect(hit!.label).toBe(want.label);
    }
    const common = r.clauses!.filter((c) => c.label === 'common');
    for (const c of common) expect(c.a!.text).toBe(c.b!.text);
  });

  it('gives differing clauses a word diff and never claims legal equivalence', () => {
    for (const c of r.clauses!.filter((x) => x.label === 'differing')) {
      expect(c.segments!.some((s) => s.op === 'del')).toBe(true);
      expect(c.segments!.some((s) => s.op === 'add')).toBe(true);
    }
    expect(JSON.stringify(r)).not.toMatch(/equivalen/i);
    // version mode carries no clause labels
    expect(diffOk(fixtureSide(exp.a), fixtureSide(exp.b)).clauses).toBeUndefined();
  });
});
