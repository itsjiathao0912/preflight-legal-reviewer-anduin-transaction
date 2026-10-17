import { describe, expect, it } from 'vitest';
import { FindingSchema } from '../../../src/findings/schema';
import { diffOk, sampleSide } from '../../unit/diff/diff-helpers';

/** AC16: "LLC Agreement" retained in #6 is at most a low-confidence, diff-only "Possible leftover". */
const B = sampleSide(6);
const r = diffOk(sampleSide(5), B);
const bText = B.structure.blocks.map((b) => b.lines.map((l) => l.text).join(' ')).join('\n');

describe('golden-06-llc-agreement-lowconf', () => {
  it('should not report LLC Agreement above low confidence', () => {
    const countInB = (bText.match(/\bLLC Agreement\b/g) ?? []).length;
    expect(countInB).toBe(11); // pinned from engine text of #6
    const hit = r.possibleLeftovers.find((l) => l.term === 'LLC Agreement');
    if (hit) {
      expect(hit.countB).toBe(countInB);
      expect(hit.confidence).toBeLessThan(0.5);
      expect(hit.confidence).toBeLessThanOrEqual(0.4);
      expect(hit.severity).toBe('low');
      expect(hit.label).toBe('Possible leftover');
      expect(hit.confidence).toBe(0.31); // pinned
    }
    for (const l of r.possibleLeftovers) expect(l.confidence).toBeLessThanOrEqual(0.4);
  });

  it('is diff-only: never a Finding on either side', () => {
    for (const f of B.findings)
      expect(f.quote.includes('LLC Agreement') && f.detector_id.includes('leftover')).toBe(false);
    for (const l of r.possibleLeftovers) expect(FindingSchema.safeParse(l).success).toBe(false);
    expect(r.possibleLeftovers.map((l) => l.term)).toEqual(['ERISA', 'LLC Agreement', 'Plan']); // pinned
  });
});
