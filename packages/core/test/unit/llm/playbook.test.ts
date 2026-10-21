import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REVIEW_PLAYBOOK } from '../../../src/llm/playbook';
import { normalizeForLocate } from '../../../src/llm/verify-quote';

interface Gt {
  docs: { defects: { id: string; anchors: string[] }[] }[];
}
const gt = JSON.parse(
  readFileSync(
    new URL('../../../../../fixtures/defect-bench/ground-truth.json', import.meta.url),
    'utf8',
  ),
) as Gt;
const squash = (s: string) => normalizeForLocate(s).text.replace(/ /g, '');

describe('playbook (AC7)', () => {
  it('contains all 6 NOT-A-DEFECT items and synthetic example keys X1 to X6', () => {
    for (const k of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6'])
      expect(REVIEW_PLAYBOOK).toMatch(new RegExp(`^${k} `, 'm'));
    expect(REVIEW_PLAYBOOK).toMatch(/statute|regulation/i);
    expect(REVIEW_PLAYBOOK).toMatch(/has the meaning given in/);
    expect(REVIEW_PLAYBOOK).toMatch(/W-8/);
    expect(REVIEW_PLAYBOOK).toMatch(/Identical re-definitions/);
    expect(REVIEW_PLAYBOOK).toMatch(/instructions block/);
    expect(REVIEW_PLAYBOOK).toMatch(/defined but never used/);
  });

  it('contains no ground-truth anchor (leakage rule)', () => {
    const anchors = gt.docs.flatMap((d) => d.defects.flatMap((x) => x.anchors));
    expect(anchors.length).toBeGreaterThanOrEqual(19);
    const pb = squash(REVIEW_PLAYBOOK);
    for (const a of anchors) expect(pb.includes(squash(a)), a).toBe(false);
  });

  it('is at most 10,000 chars', () => {
    expect(REVIEW_PLAYBOOK.length).toBeLessThanOrEqual(10_000);
  });
});
