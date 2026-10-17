// AC11 (ai-review-stream-dedup D3b): verifyAiResult drops verified AI findings that overlap a
// rule-finding anchor when ctx.ruleFindings is given; without it the output is unchanged.
import { describe, expect, it } from 'vitest';
import type { Finding } from '../../../src/findings/schema';
import { verifyAiResult } from '../../../src/llm/verify-quote';
import { aiFinding, CTX, llmDoc } from '../../helpers/llm-docs';

const g = llmDoc();
const blockOf = (needle: string) =>
  g.structure.blocks.findIndex((b) => b.lines.some((l) => l.text.includes(needle)));
const textOf = (bi: number) => g.structure.blocks[bi]!.lines.map((l) => l.text).join(' ');
const rejectBlock = g.structure.blocks[blockOf('may reject')]!;
const rejectAt = textOf(blockOf('may reject')).indexOf('The Fund may reject');

const result = {
  v: 1,
  findings: [
    aiFinding({
      candidate_id: 'c1',
      quote: 'The Fund may reject this subscription in whole or in part.',
    }),
    aiFinding({
      candidate_id: 'c2',
      quote: 'Payment is due within “five business days” of acceptance.',
    }),
  ],
};

function ruleAt(blockId: string, start: number, end: number, kind = 'rule') {
  return {
    detector_kind: kind,
    anchor: { docHash: g.structure.docHash, blockId, offsetStart: start, offsetEnd: end },
  } as Pick<Finding, 'anchor' | 'detector_kind'>;
}

describe('ai-verify-suppresses-rule-duplicates (AC11)', () => {
  it('without ruleFindings the outcome has no suppressed key and is unchanged', () => {
    const out = verifyAiResult(g, result, CTX);
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(2);
    expect('suppressed' in out).toBe(false);
  });

  it('should drop a verified AI finding on a rule-anchored sentence and report suppressed', () => {
    const base = verifyAiResult(g, result, CTX);
    const out = verifyAiResult(g, result, {
      ...CTX,
      ruleFindings: [ruleAt(rejectBlock.id, rejectAt + 4, rejectAt + 8)],
    });
    if (!out.ok || !base.ok) throw new Error('schema');
    expect(out.suppressed).toBe(1);
    expect(out.findings).toEqual([base.findings[1]]);
    expect(out.rejected).toEqual(base.rejected);
  });

  it('non-rule findings and anchors in other blocks suppress nothing (suppressed: 0)', () => {
    const out = verifyAiResult(g, result, {
      ...CTX,
      ruleFindings: [ruleAt(rejectBlock.id, rejectAt, rejectAt + 5, 'ai'), ruleAt('bX', 0, 999)],
    });
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(2);
    expect(out.suppressed).toBe(0);
  });

  it('an empty ruleFindings list reports suppressed: 0', () => {
    const out = verifyAiResult(g, result, { ...CTX, ruleFindings: [] });
    expect(out.ok && out.suppressed).toBe(0);
  });
});
