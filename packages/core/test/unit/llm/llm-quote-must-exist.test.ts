import { describe, expect, it } from 'vitest';
import { verifyAiResult, locateQuote } from '../../../src/llm/verify-quote';
import { CTX, aiFinding, llmDoc } from '../../helpers/llm-docs';

describe('llm-quote-must-exist (AC28)', () => {
  const g = llmDoc();

  it('should reject an AI finding whose quote is not in the document', () => {
    const out = verifyAiResult(
      g,
      { v: 1, findings: [aiFinding({ quote: 'The Fund guarantees a 12% annual return.' })] },
      CTX,
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.findings).toHaveLength(0);
    expect(out.rejected).toEqual([{ candidate_id: 'c1', reason: 'quote_not_found' }]);
  });

  it('should snap the fingerprint quote to the document sentence', () => {
    const out = verifyAiResult(
      g,
      { v: 1, findings: [aiFinding({ quote: 'reject this subscription' })] },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(1);
    const f = out.findings[0]!;
    expect(f.quote).toBe('The Fund may reject this subscription in whole or in part.');
    expect(f.detector_kind).toBe('ai');
    expect(f.model).toBe(CTX.model);
    expect(f.provenance).toBe('fresh');
    expect(f.detail.facts.source).toBe('AI suggestion');
  });

  it('locates tolerantly: case, whitespace, curly vs straight quotes, wrapping quotes', () => {
    expect(locateQuote(g, 'THE FUND   MAY reject')).not.toBeNull();
    expect(locateQuote(g, 'due within "five business days"')).not.toBeNull();
    expect(locateQuote(g, '“The Subscriber agrees…')).not.toBeNull();
    expect(locateQuote(g, 'The Subscriber disagrees')).toBeNull();
    expect(locateQuote(g, '   ')).toBeNull();
  });

  it('rejects oversized quotes and schema-invalid findings individually, keeps valid ones', () => {
    const out = verifyAiResult(
      g,
      {
        v: 1,
        findings: [
          aiFinding({ candidate_id: 'big', quote: 'x'.repeat(1001) }),
          aiFinding({ candidate_id: 'bad', issue_class: 'not_a_class' }),
          aiFinding({ candidate_id: 'ok' }),
        ],
      },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    expect(out.findings.map((f) => f.detail.facts.candidate_id)).toEqual(['ok']);
    expect(out.rejected).toEqual([
      { candidate_id: 'big', reason: 'quote_too_long' },
      { candidate_id: 'bad', reason: 'schema' },
    ]);
  });

  it('rejects a non-envelope result without throwing', () => {
    for (const bad of [null, 'text', { v: 2, findings: [] }, { v: 1 }, [1, 2]])
      expect(verifyAiResult(g, bad, CTX)).toEqual({ ok: false, reason: 'schema' });
  });

  it('cached results re-verify to the same findings with cache provenance', () => {
    const r = { v: 1, findings: [aiFinding()] };
    const a = verifyAiResult(g, r, CTX);
    const b = verifyAiResult(g, JSON.parse(JSON.stringify(r)), { ...CTX, provenance: 'cache' });
    if (!a.ok || !b.ok) throw new Error('schema');
    expect(b.findings[0]!.id).toBe(a.findings[0]!.id);
    expect(b.findings[0]!.provenance).toBe('cache');
  });
});
