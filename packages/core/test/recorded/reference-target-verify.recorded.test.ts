import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { buildReferencePairs } from '../../src/llm/reference-pairs';
import { TASKS } from '../../src/llm/registry';
import { verifyAiResult } from '../../src/llm/verify-quote';

// Recorded-shape replay of a reference-target answer (AC5): the verify chain is scoped to the
// pointer sentence, so only a quote copied from the pointer can anchor a finding.
const HTML = `<html><body>
<h2>3. Investor Questionnaire:</h2>
<ol><li>(e) Each Investor who is a natural person should respond to Section E.</li></ol>
<h2>SIGNATURE PAGE</h2>
<p>E. Supplemental Data for Entities</p>
<p>1. If the Investor is not a natural person, furnish the following supplemental data.</p>
</body></html>`;

const g = analyzeHtml(HTML);
const findings = runDeterministic(g);
const { candidates, sites } = buildReferencePairs(g, findings);
const pair = candidates.find((c) => c.quote.includes('Section E'))!;
const finding = (quote: string, verdict = 'mismatch') => ({
  candidate_id: pair.id,
  label: 'Section E',
  verdict,
  issue_class: 'broken_cross_reference',
  severity: 'high',
  confidence: 0.8,
  quote,
  explanation:
    'The pointer sends natural persons to Section E, whose heading says it is for entities.',
  interpretations: [],
});
const run = (quote: string, verdict = 'mismatch') => {
  const v = TASKS['reference-target'].validate(
    { findings: [finding(quote, verdict)] },
    { candidates },
  );
  if (!v.ok) throw new Error('malformed');
  const out = verifyAiResult(g, v.result, {
    model: 'm',
    provenance: 'fresh',
    task: 'reference-target',
    sites,
    ruleFindings: findings,
  });
  if (!out.ok) throw new Error('schema');
  return out;
};

describe('reference-target verify chain (AC5)', () => {
  it('accepts a quote copied from the pointer sentence and anchors at the pointer', () => {
    const out = run('natural person should respond to Section E');
    expect(out.rejected).toEqual([]);
    expect(out.findings).toHaveLength(1);
    const f = out.findings[0]!;
    expect(f.detector_id).toBe('ai:reference-target');
    expect(f.quote).toBe('(e) Each Investor who is a natural person should respond to Section E.');
    expect(f.severity).toBe('high');
  });

  it('rejects a quote copied from the TARGET block text as quote_not_found', () => {
    const out = run('Supplemental Data for Entities');
    expect(out.findings).toEqual([]);
    expect(out.rejected).toEqual([{ candidate_id: pair.id, reason: 'quote_not_found' }]);
  });

  it('rejects a quote spanning pointer plus target as quote_not_found', () => {
    const out = run(
      'should respond to Section E.\n[TARGET Section E: Supplemental Data for Entities',
    );
    expect(out.findings).toEqual([]);
    expect(out.rejected).toEqual([{ candidate_id: pair.id, reason: 'quote_not_found' }]);
  });

  it('a match verdict produces no finding and no rejection', () => {
    const out = run('natural person should respond to Section E', 'match');
    expect(out.findings).toEqual([]);
    expect(out.rejected).toEqual([]);
  });
});
