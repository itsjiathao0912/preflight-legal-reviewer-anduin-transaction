import { describe, expect, it } from 'vitest';
import { DiffResultSchema, QUOTE_SIMILARITY } from '../../../src/diff/index';
import { quoteTokens } from '../../../src/diff/findings-delta';
import { jaccard } from '../../../src/diff/normalize-key';
import { diffOk, sampleSide } from '../../unit/diff/diff-helpers';

/**
 * Golden #5 (2024) -> #6 (2026). Counts, ids and thresholds are pinned from engine output (Phase 07
 * report); the semantic facts are named assertions so the test is not a tautology.
 */
const A = sampleSide(5);
const B = sampleSide(6);
const r = diffOk(A, B);
const bText = B.structure.blocks.map((b) => b.lines.map((l) => l.text).join(' ')).join('\n');

describe('golden-05-06-drift', () => {
  it('produces a schema-valid result with the pinned section summary', () => {
    expect(DiffResultSchema.safeParse(r).success).toBe(true);
    expect(r.notice).toBe('none');
    expect(r.summary.sections).toEqual({
      added: 0,
      removed: 1,
      renamed: 1,
      moved: 0,
      changed: 21,
      same: 9,
    });
    expect(r.summary.findings).toEqual({ fixed: 4, stillPresent: 3, new: 0 });
    expect(r.sections.some((s) => s.truncated)).toBe(false);
  });

  it('should report both swapped references as fixed between 5 and 6', () => {
    const refsA = A.findings.filter((f) => f.detector_id === 'ref-label-coherence');
    expect(refsA).toHaveLength(2);
    const fixed = r.findingsDelta.fixed.filter((d) => d.detector_id === 'ref-label-coherence');
    expect(fixed.map((d) => d.findingIdA).sort()).toEqual(refsA.map((f) => f.id).sort());
    expect(B.findings.some((f) => f.detector_id === 'ref-label-coherence')).toBe(false);
  });

  it('should report Appendix C removed', () => {
    const removed = r.sections.filter((s) => s.status === 'removed');
    expect(removed.map((s) => s.keyA)).toEqual(['appendix:c']);
    expect(removed[0]!.titleA).toMatch(/APPENDIX C$/);
    expect(r.sections.some((s) => s.keyB === 'appendix:c')).toBe(false);
    // references to it fall to 0 in the new version
    expect(bText.match(/Appendix C/gi) ?? []).toHaveLength(0);
  });

  it('should infer Units to Shares as a rename (and the other four renames, nothing else)', () => {
    expect(r.renames.map((x) => [x.from, x.to, x.count, x.occurrences])).toEqual([
      ['Member', 'Shareholder', 4, 4],
      ['Memorandum', 'Prospectus', 8, 8],
      ['Placement Fee', 'Sales Load', 3, 3],
      ['Units', 'Shares', 29, 35],
      ['placement agent', 'distributor', 4, 4],
    ]);
    for (const x of r.renames) {
      expect(x.count).toBeGreaterThanOrEqual(3);
      expect(x.count / x.occurrences).toBeGreaterThanOrEqual(0.8);
    }
    const defs = r.definitions.filter((d) => d.status === 'renamed').map((d) => [d.term, d.termB]);
    expect(defs).toEqual([
      ['Member', 'Shareholder'],
      ['Memorandum', 'Prospectus'],
      ['Units', 'Shares'],
    ]);
  });

  it('reports the class fees 3.5% Class A and 1.5% Class S', () => {
    const b = r.fees.filter((f) => f.b).map((f) => [f.status, f.b!.percent, f.b!.feeClass ?? null]);
    expect(b).toContainEqual(['changed', '3.5%', 'A']);
    expect(b).toContainEqual(['added', '1.5%', 'S']);
    expect(r.fees.find((f) => f.status === 'changed')!.a).toMatchObject({ percent: '3.5%' });
    expect(r.fees.find((f) => f.status === 'changed')!.a!.feeClass).toBeUndefined();
  });

  it('removes the drafting note and the [xx] placeholder but keeps the [insert …] placeholder', () => {
    const fixed = r.findingsDelta.fixed.map((d) => d.detector_id).sort();
    expect(fixed).toEqual([
      'flag-drafting-note',
      'flag-placeholder',
      'ref-label-coherence',
      'ref-label-coherence',
    ]);
    expect(
      r.findingsDelta.fixed.find((d) => d.detector_id === 'flag-placeholder')!.excerpt.text,
    ).toContain('[xx]');
    const kept = r.findingsDelta.stillPresent.find((d) => d.detector_id === 'flag-placeholder')!;
    expect(kept.excerpt.text).toContain('[insert investor name]');
    expect(B.findings.some((f) => f.detector_id === 'flag-drafting-note')).toBe(false);
    expect(r.findingsDelta.new).toEqual([]);
  });

  it('keeps sections 1-12 and Parts A-D; the only relabel is Part A of section 6 (Unit -> Share class)', () => {
    const sig = r.sections.filter((s) => (s.keyA ?? s.keyB)!.startsWith('signature:1/'));
    expect(
      sig.some((s) => s.status === 'added' || s.status === 'removed' || s.status === 'moved'),
    ).toBe(false);
    for (let n = 1; n <= 12; n++)
      expect(
        sig.some((s) => s.keyA === `signature:1/s${n}` || s.keyA?.startsWith(`signature:1/s${n}/`)),
      ).toBe(true);
    const renamed = r.sections.filter((s) => s.status === 'renamed');
    expect(renamed.map((s) => [s.keyA, s.titleA, s.titleB])).toEqual([
      ['signature:1/s6/pa', 'Unit class', 'Share class'],
    ]);
  });

  it('pins the findings-delta quote similarity threshold between rejected and accepted pairs', () => {
    expect(QUOTE_SIMILARITY).toBe(0.5);
    const accepted = r.findingsDelta.stillPresent.map((d) => d.similarity!);
    expect(Math.min(...accepted)).toBe(1);
    // best same-detector candidate for each fixed finding stays below the threshold
    let best = 0;
    for (const d of r.findingsDelta.fixed) {
      const fa = A.findings.find((f) => f.id === d.findingIdA)!;
      for (const fb of B.findings.filter((f) => f.detector_id === fa.detector_id))
        best = Math.max(best, jaccard(quoteTokens(fa.quote), quoteTokens(fb.quote)));
    }
    console.log(`golden-05-06: max rejected same-detector quote similarity ${best.toFixed(3)}`);
    expect(best).toBeLessThan(QUOTE_SIMILARITY);
  });
});
