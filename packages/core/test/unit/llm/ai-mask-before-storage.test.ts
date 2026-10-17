import { describe, expect, it } from 'vitest';
import { quoteHash } from '../../../src/memory/fingerprint';
import { buildAiCandidates } from '../../../src/llm/candidates';
import { verifyAiResult } from '../../../src/llm/verify-quote';
import { analyzeHtml, runDeterministic } from '../../../src/engine';
import { CTX, aiFinding, llmDoc } from '../../helpers/llm-docs';

describe('ai-mask-before-storage (AC28, R2 mask path)', () => {
  const g = llmDoc();

  it('masks account digits in the snapped sentence BEFORE quote_hash and in every stored text', () => {
    const out = verifyAiResult(
      g,
      {
        v: 1,
        findings: [
          aiFinding({
            issue_class: 'sensitive_data',
            severity: 'medium',
            quote: 'funds to account 021000021', // >= 3 words (review M1 minimum)
            explanation: 'Account 021000021 is printed in the form.',
            interpretations: ['Remove 021000021 from the form.'],
          }),
        ],
      },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    const f = out.findings[0]!;
    const stored = JSON.stringify(f);
    expect(stored).not.toContain('021000021');
    expect(f.quote).toContain('#0021');
    expect(f.quote_snippet).toContain('#0021');
    expect(f.quote_hash).toBe(quoteHash(f.quote));
    expect(f.quote_hash).not.toBe(quoteHash('Wire funds to account 021000021 at First Bank.'));
  });

  it('candidates sent to the Worker are masked too', () => {
    // with the real detectors the account sentence carries a sensitive_data rule finding, so it is
    // never a candidate (ai-review-stream-dedup D3a); without findings the mask path still applies
    const doc = analyzeHtml(
      '<html><body><p><b>1. TERMS</b></p><p>If the investor is an IRA, wire to account 021000021, see Annex Z.</p></body></html>',
    );
    expect(JSON.stringify(buildAiCandidates(doc, runDeterministic(doc)))).not.toContain(
      '021000021',
    );
    const cands = buildAiCandidates(doc, []);
    expect(cands.length).toBeGreaterThan(0);
    expect(JSON.stringify(cands)).not.toContain('021000021');
    expect(JSON.stringify(cands)).toContain('#0021');
  });
});
