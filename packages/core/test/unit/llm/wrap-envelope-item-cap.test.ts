// Phase 05 review L3: wrapEnvelope bounds the per-item work to limits.aiCandidates * 3 model items;
// the rest count as dropped (no frozen schema change).
import { describe, expect, it } from 'vitest';
import { limits } from '../../../src/config/limits';
import { TASKS } from '../../../src/llm/registry';

describe('wrap-envelope-item-cap (review L3)', () => {
  it('validates at most aiCandidates * 3 model findings, the rest are dropped', () => {
    const candidates = [
      { id: 'c1', quote: 'The Fund may reject this subscription.', section_path: ['1'] },
    ];
    const item = {
      candidate_id: 'c1',
      issue_class: 'ambiguity',
      severity: 'medium',
      confidence: 0.5,
      quote: 'The Fund may reject this subscription.',
      explanation: 'Unclear.',
      interpretations: ['a', 'b'],
    };
    const cap = limits.aiCandidates * 3;
    const v = TASKS['clause-judgment'].validate(
      { findings: Array.from({ length: cap + 50 }, () => ({ ...item })) },
      { candidates },
    );
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.dropped).toBeGreaterThanOrEqual(50);
    expect(v.result.findings.length).toBeLessThanOrEqual(cap);
  });
});
