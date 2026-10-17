// Phase 05 review M1: quote-must-exist is scoped to the cited candidate's own sentence and needs a
// minimum normalized length (>= 12 chars and >= 3 words).
import { describe, expect, it } from 'vitest';
import { buildAiCandidatesWithSites } from '../../../src/llm/candidates';
import { runDeterministic } from '../../../src/engine';
import {
  candidateSitesFor,
  quoteLongEnough,
  verifyAiResult,
  type VerifyAiContext,
} from '../../../src/llm/verify-quote';
import { aiFinding, llmDoc } from '../../helpers/llm-docs';

const g = llmDoc();
const blockOf = (needle: string) =>
  g.structure.blocks.findIndex((b) => b.lines.some((l) => l.text.includes(needle)));
const textOf = (bi: number) => g.structure.blocks[bi]!.lines.map((l) => l.text).join(' ');

// c_reject cites ONLY the "The Fund may reject ..." sentence; c_pay cites the payment sentence
const rejectBlock = blockOf('may reject');
const rejectStart = textOf(rejectBlock).indexOf('The Fund may reject');
const payBlock = blockOf('Payment is due');
const payStart = textOf(payBlock).indexOf('Payment is due');
const CTX: VerifyAiContext = {
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  provenance: 'fresh',
  sites: [
    {
      id: 'c_reject',
      blockIndex: rejectBlock,
      start: rejectStart,
      end: textOf(rejectBlock).length,
    },
    { id: 'c_pay', blockIndex: payBlock, start: payStart, end: textOf(payBlock).length },
  ],
};

describe('llm-quote-scoped-to-candidate (review M1)', () => {
  it('rejects a one-word quote as quote_too_short', () => {
    const out = verifyAiResult(
      g,
      { v: 1, findings: [aiFinding({ candidate_id: 'c_reject', quote: 'reject' })] },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(0);
    expect(out.rejected).toEqual([{ candidate_id: 'c_reject', reason: 'quote_too_short' }]);
  });

  it('rejects a short two-word quote and accepts >= 3 words / >= 12 chars', () => {
    expect(quoteLongEnough('The Fund')).toBe(false);
    expect(quoteLongEnough('a b c')).toBe(false); // 3 words but under 12 chars
    expect(quoteLongEnough('“The Fund may”')).toBe(true);
    const out = verifyAiResult(
      g,
      { v: 1, findings: [aiFinding({ candidate_id: 'c_reject', quote: 'The Fund may reject' })] },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(1);
  });

  it('rejects a quote that exists elsewhere in the document but not in the cited candidate', () => {
    // the quote is in the document (the subscriber sentence of the same block, and the payment
    // sentence) but neither is the cited candidate's sentence
    const out = verifyAiResult(
      g,
      {
        v: 1,
        findings: [
          aiFinding({ candidate_id: 'c_reject', quote: 'The Subscriber agrees to purchase' }),
          aiFinding({ candidate_id: 'c_reject', quote: 'Payment is due within' }),
          aiFinding({ candidate_id: 'c_pay', quote: 'The Fund may reject this subscription' }),
        ],
      },
      CTX,
    );
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(0);
    expect(out.rejected.map((r) => r.reason)).toEqual([
      'quote_not_found',
      'quote_not_found',
      'quote_not_found',
    ]);
  });

  it('rejects an unknown candidate id even when the quote is in the document', () => {
    const out = verifyAiResult(g, { v: 1, findings: [aiFinding({ candidate_id: 'ghost' })] }, CTX);
    if (!out.ok) throw new Error('schema');
    expect(out.rejected).toEqual([{ candidate_id: 'ghost', reason: 'quote_not_found' }]);
  });

  it('without explicit sites, recomputes the engine candidate sites deterministically', () => {
    const { candidates, sites } = buildAiCandidatesWithSites(g, runDeterministic(g));
    expect(candidateSitesFor(g)).toEqual(sites);
    expect(sites.map((s) => s.id)).toEqual(candidates.map((c) => c.id));
  });
});
