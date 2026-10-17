import { describe, expect, it } from 'vitest';
import { quoteHash } from '../../../src/memory/fingerprint';
import { buildAiCandidates } from '../../../src/llm/candidates';
import { verifyAiResult } from '../../../src/llm/verify-quote';
import { runDeterministic } from '../../../src/engine';
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
            quote: 'account 021000021',
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
    const cands = buildAiCandidates(g, runDeterministic(g));
    expect(JSON.stringify(cands)).not.toContain('021000021');
    expect(JSON.stringify(cands)).toContain('#0021');
  });
});
