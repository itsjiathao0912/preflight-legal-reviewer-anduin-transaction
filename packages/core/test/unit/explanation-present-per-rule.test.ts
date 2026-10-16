import { describe, expect, it } from 'vitest';
import { detectors } from '../../src/detectors/registry';
import { analyzed } from '../helpers/samples';

describe('explanation-present-per-rule (AC9)', () => {
  it('every registered detector supplies explain() and patternKey()', () => {
    expect(detectors.length).toBeGreaterThanOrEqual(3);
    for (const d of detectors) {
      expect(typeof d.explain).toBe('function');
      expect(typeof d.patternKey).toBe('function');
      expect(
        d.explain({ reference: 'x', used_term: 'Units', defined_term: 'Shares' }).length,
      ).toBeGreaterThan(10);
      expect(d.patternKey({ used_term: 'Units', defined_term: 'Shares', cited_part: 'B' })).toMatch(
        /^[a-z0-9:#>-]{1,80}$/,
      );
    }
    expect(new Set(detectors.map((d) => d.id)).size).toBe(detectors.length);
  });

  it('every finding on the golden samples states its rule and facts', () => {
    for (const n of [1, 3, 5, 11]) {
      for (const f of analyzed(n).findings) {
        const d = detectors.find((x) => x.id === f.detector_id)!;
        expect(d).toBeDefined();
        expect(f.detail.explanation).toBe(d.explain(f.detail.facts));
        expect(Object.keys(f.detail.facts).length).toBeGreaterThanOrEqual(3);
        expect(f.detail.expected).toBeTruthy();
        expect(f.pattern_key).toBe(d.patternKey(f.detail.facts));
        expect(f.pattern_key).not.toMatch(/\d/);
      }
    }
  });
});
