import { describe, expect, it } from 'vitest';
import { FindingSchema } from '../../../src/findings/schema';
import { isBlocking } from '../../../src/findings/severity';
import { verifyAiResult } from '../../../src/llm/verify-quote';
import { CTX, aiFinding, llmDoc } from '../../helpers/llm-docs';

describe('ai-severity-cap (AC28)', () => {
  const g = llmDoc();

  it('should not exceed severity high for AI-only findings', () => {
    const out = verifyAiResult(
      g,
      {
        v: 1,
        findings: [
          aiFinding({ severity: 'critical', candidate_id: 'crit' }),
          aiFinding({ severity: 'high' }),
        ],
      },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    // 'critical' is outside the AI enum: rejected individually, never promoted to a gating finding
    expect(out.rejected).toEqual([{ candidate_id: 'crit', reason: 'schema' }]);
    expect(out.findings).toHaveLength(1);
    expect(out.findings[0]!.severity).toBe('high');
    expect(out.findings.every((f) => f.severity !== 'critical')).toBe(true);
  });

  it('caps sensitive_data AI findings at medium and labels every AI finding "AI suggestion"', () => {
    const out = verifyAiResult(
      g,
      {
        v: 1,
        findings: [
          aiFinding({
            issue_class: 'sensitive_data',
            severity: 'high',
            quote: 'Wire funds to account',
          }),
        ],
      },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    const f = out.findings[0]!;
    expect(f.severity).toBe('medium');
    expect(f.detail.facts.source).toBe('AI suggestion');
    expect(FindingSchema.safeParse(f).success).toBe(true);
  });

  it('an AI finding can never be critical (the gate only counts it after analyst promotion)', () => {
    const out = verifyAiResult(g, { v: 1, findings: [aiFinding({ severity: 'high' })] }, CTX);
    if (!out.ok) throw new Error('schema');
    expect(out.findings[0]!.severity).not.toBe('critical');
    expect(FindingSchema.safeParse({ ...out.findings[0]!, severity: 'critical' }).success).toBe(
      false,
    );
    expect(isBlocking(out.findings[0]!.severity)).toBe(true); // high still shows; promotion is a UI action
  });
});
