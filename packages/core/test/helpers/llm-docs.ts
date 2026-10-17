import { analyzeHtml } from '../../src/engine';
import type { DocGraph } from '../../src/graph/graph';

/** Small synthetic document for the LLM verify-chain tests (untrusted input: parse only). */
export const LLM_DOC_HTML = `<html><body>
<p><b>1. SUBSCRIPTION</b></p>
<p>The Subscriber agrees to purchase the Units described below. The Fund may reject this subscription in whole or in part.</p>
<p><b>2. PAYMENT</b></p>
<p>Wire funds to account 021000021 at First Bank. Payment is due within “five business days” of acceptance.</p>
</body></html>`;

export function llmDoc(): DocGraph {
  return analyzeHtml(LLM_DOC_HTML);
}

export function aiFinding(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    candidate_id: 'c1',
    issue_class: 'ambiguity',
    severity: 'medium',
    confidence: 0.6,
    quote: 'The Fund may reject this subscription in whole or in part.',
    explanation: 'It is unclear when a partial rejection applies.',
    interpretations: ['Rejection is discretionary.', 'Rejection needs a stated reason.'],
    ...over,
  };
}

export const CTX = {
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  provenance: 'fresh',
} as const;
