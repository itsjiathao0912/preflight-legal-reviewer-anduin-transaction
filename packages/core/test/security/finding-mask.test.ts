import { describe, expect, it } from 'vitest';
import { analyzeHtml } from '../../src/engine';
import { buildFinding } from '../../src/findings/make-finding';
import { quoteHash } from '../../src/memory/fingerprint';
import { normalize } from '../../src/memory/normalize';
import { sha256Hex } from '../../src/model/hash';

/** F2: quote / quote_snippet / quote_hash always use masked text, even when the detector passes no spans. */
describe('finding default masking', () => {
  it('masks an ABA routing number found in the sentence', () => {
    const g = analyzeHtml('<p>Wire funds to ABA 021000021 at First Bank.</p>');
    const bi = g.structure.blocks.findIndex((b) => b.lines.some((l) => l.text.includes('ABA')));
    expect(bi).toBeGreaterThanOrEqual(0);
    const text = g.structure.blocks[bi]!.lines.map((l) => l.text).join(' ');
    const at = text.indexOf('Wire');
    const f = buildFinding(g, {
      detectorId: 'test',
      issueClass: 'broken_cross_reference',
      severity: 'low',
      confidence: 0.5,
      blockIndex: bi,
      matchStart: at,
      matchEnd: at + 4,
      explanation: 'x',
      facts: {},
    });
    expect(f.quote).toContain('#0021');
    expect(f.quote).not.toContain('021000021');
    expect(f.quote_snippet).toContain('#0021');
    expect(f.quote_snippet).not.toContain('021000021');
    expect(f.quote_hash).toBe(quoteHash(f.quote));
    expect(f.quote_hash).toBe(sha256Hex(normalize('Wire funds to ABA #0021 at First Bank.')));
  });
});
