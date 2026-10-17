import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';

const SENTENCE =
  'If the Investor holds its Interests through a Custodian, the Investor shall send a copy of the executed signature pages to the Custodian indicated in Part B of Section 6.';

const HTML = `<html><body>
<p>INSTRUCTIONS</p><p>${SENTENCE}</p>
<p>Section 4. Investor and Custodian Information</p><p>Name of the Custodian: ______</p>
<p>Section 6. Investor Status</p><p>Part A. Individuals</p><p>Check one.</p>
<p>Part B. Trusts and Public Plan Investors</p><p>Check one.</p>
</body></html>`;

describe('ref-label-coherence noun window', () => {
  it('should stop the subject window at "to the" (no "page custodian")', () => {
    const g = analyzeHtml(new TextEncoder().encode(HTML));
    const f = runDeterministic(g).filter((x) => x.detector_id === 'ref-label-coherence');
    expect(f).toHaveLength(1);
    expect(f[0]!.detail.facts.noun_window).toBe('custodian');
    expect(f[0]!.detail.explanation).not.toContain('page custodian');
    expect(f[0]!.detail.expected).toMatch(/^Section 4 /);
  });
});
