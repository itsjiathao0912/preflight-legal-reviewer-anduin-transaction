import { describe, expect, it } from 'vitest';
import { scoreReference } from '../../src/detectors/ref-label-coherence';
import { analyzed } from '../helpers/samples';

const PHASE01_DETECTORS = ['ref-this-section', 'ref-label-coherence', 'undefined-term'];

describe.each([3, 5])('golden-03-05-swapped-part-b-refs (AC12, sample #%i)', (n) => {
  const { g, findings } = analyzed(n);
  const xref = findings.filter((f) => f.issue_class === 'broken_cross_reference');
  const partRefs = g.structure.references.filter((r) => r.form === 'part_of_section');

  it('should flag Custodian Part B of Section 6 (custodian is Section 4)', () => {
    const f = xref.filter((x) => x.quote.includes('Custodian indicated in Part B of Section 6'));
    expect(f).toHaveLength(1);
    expect(f[0]!.detector_id).toBe('ref-label-coherence');
    expect(f[0]!.detail.expected).toBe('Section 4 (CUSTODIAN INFORMATION)');
    expect(f[0]!.detail.facts.noun_window).toBe('custodian');
    expect(f[0]!.detail.facts.cited_overlap).toBe(0);
    expect(f[0]!.detail.facts.expected_overlap).toBe(1);
    // demo-readiness 17-10-26: the ref sits in the instructions scope (a payment/delivery
    // instruction the investor follows), so a wrong target blocks digitization.
    expect(f[0]!.detail.facts.routing_context).toBe('instructions');
    expect(f[0]!.severity).toBe('critical');
    expect(f[0]!.confidence).toBeLessThanOrEqual(0.7);
    // internal fit scores stay in facts, never in the explanation text
    expect(f[0]!.detail.explanation).toBe(
      '"custodian" is said to be in Part B of Section 6, but that target is "Investment amount"; it fits Section 4 (CUSTODIAN INFORMATION) better.',
    );
    expect(f[0]!.detail.explanation).not.toMatch(/fit \d/);
  });

  it('should flag amount Part B of Section 4 (amount is Section 6 Part B)', () => {
    const f = xref.filter((x) => x.quote.includes('amount specified in Part B of Section 4'));
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.expected).toBe('Section 6 Part B (Investment amount)');
    expect(f[0]!.detail.facts.noun_window).toBe('amount');
    expect(f[0]!.detail.facts.cited_overlap).toBe(0);
    expect(f[0]!.detail.facts.expected_overlap).toBe(1);
    expect(f[0]!.detail.facts.routing_context).toBe('instructions');
    expect(f[0]!.severity).toBe('critical');
    expect(f[0]!.detail.explanation).not.toMatch(/fit \d/);
  });

  it('exactly 2 broken_cross_reference findings; the 2 golden refs are marked suspicious', () => {
    expect(xref).toHaveLength(2);
    expect(partRefs.filter((r) => r.ref.status === 'suspicious')).toHaveLength(2);
  });

  it('the strict "Part X of Section N" pattern matches 10 times: 8 valid refs, 0 findings on them', () => {
    expect(partRefs).toHaveLength(10);
    const valid = partRefs.filter((r) => r.ref.status !== 'suspicious');
    expect(valid).toHaveLength(8);
    for (const r of valid) expect(r.ref.status).toBe('resolved');
    for (const r of valid) {
      const s = scoreReference(g, r);
      if (s) {
        expect(s.fire).toBe(false);
        expect(s.p).toBeGreaterThanOrEqual(0.5);
      }
    }
    const texts = valid.map((r) =>
      g.structure.blocks[r.blockIndex]!.lines.map((l) => l.text).join(' '),
    );
    expect(texts.some((t) => t.includes('Part A of Section 3 and/or Section 5'))).toBe(true);
  });

  it('negative: zero defined_term_issue and no other finding on this doc', () => {
    expect(findings.filter((f) => f.issue_class === 'defined_term_issue')).toHaveLength(0);
    // Phase 02 (E2): "no other finding" holds for the Phase 01 detector ids; the AC10 flags
    // (NTD, placeholders, sensitive ABA/DDA) are legitimate new findings with their own tests.
    expect(findings.filter((f) => PHASE01_DETECTORS.includes(f.detector_id))).toHaveLength(2);
  });
});

describe('AC12 total', () => {
  it('4 findings across #3 and #5', () => {
    const total = [3, 5].map(
      (n) => analyzed(n).findings.filter((f) => f.detector_id === 'ref-label-coherence').length,
    );
    expect(total.reduce((a, b) => a + b, 0)).toBe(4);
  });
});
