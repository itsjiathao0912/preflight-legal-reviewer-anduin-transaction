import { describe, expect, it } from 'vitest';
import { computeGate } from '../../src/counsel/gate';
import type { GateFinding, GateState, VarianceGatePolicy } from '../../src/counsel/types';
import { FindingSchema, type Finding } from '../../src/findings/schema';
import { quoteHash } from '../../src/memory/fingerprint';
import { loadVarianceRules, runVariance } from '../../src/variance/index';
import { demoPair } from '../helpers/variance';

/**
 * AC-V9 (core, Hybrid): AI findings that contradict the rules change nothing. Precondition: a
 * hand-built recorded-shape AI findings array (no network). Classes, owners, impact and gate are
 * byte-equal with and without them; an AI finding never gates, even when asked.
 */
function aiFinding(id: string, docHash: string, quote: string, claim: string): Finding {
  return FindingSchema.parse({
    id,
    issue_class: 'version_drift',
    severity: 'high',
    detector_kind: 'ai',
    detector_id: 'ai.version_drift',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    provenance: 'cache',
    confidence: 0.99,
    anchor: { docHash, blockId: 'b1', offsetStart: 0, offsetEnd: quote.length },
    section_path: [],
    quote_snippet: quote,
    quote,
    quote_hash: quoteHash(quote),
    detail: {
      explanation: claim,
      facts: { kind: 'change', change_type: 'changed_cosmetic', suggested_owners: 'gp' },
      interpretations: [],
    },
  });
}

describe('variance-ai-never-gates-core', () => {
  it('leaves classes, owners, impact and the gate byte-equal when contradicting AI findings are present', () => {
    const { baseline, current } = demoPair();
    const without = runVariance({ baseline, current });
    const ai = [
      aiFinding(
        'f_ai_7a',
        current.structure.docHash,
        '7A. Source of Funds Verification',
        'AI: Section 7A is cosmetic; owner GP.',
      ),
      aiFinding(
        'f_ai_42',
        current.structure.docHash,
        'formed or organized outside the United States',
        'AI: no impact; reusable.',
      ),
    ];
    const withAi = runVariance({
      baseline: { ...baseline, findings: [...baseline.findings, ai[1]!] },
      current: { ...current, findings: [...current.findings, ...ai] },
    });
    expect(JSON.stringify(withAi)).toBe(JSON.stringify(without));

    const policy: VarianceGatePolicy = loadVarianceRules().config.gate_policy;
    const gateRows = (extra: GateFinding[]) => [
      ...without.findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        detector_kind: f.detector_kind,
        gates: true,
      })),
      ...extra,
    ];
    const states: Record<string, GateState> = {};
    const g0 = computeGate(gateRows([]), states, {}, policy);
    const aiRows: GateFinding[] = ai.map((f) => ({
      id: f.id,
      severity: f.severity,
      detector_kind: 'ai',
      gates: true,
    }));
    // asked and unanswered AI questions still never gate
    for (const f of ai)
      states[f.id] = { status: 'counsel', ownerAnswers: { counsel: null, gp: null } };
    const g1 = computeGate(gateRows(aiRows), states, {}, policy);
    expect(JSON.stringify(g1)).toBe(JSON.stringify(g0));
    expect(g1.reasons.some((r) => r.findingKey.startsWith('f_ai'))).toBe(false);
    expect(g0.status).toBe('blocked'); // the 7 untriaged changes block on their own
  });
});
