import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { sensitiveSpans } from '../../src/memory/mask';
import { analyzed, blockText } from '../helpers/samples';

/**
 * AC10 trust boundary: no finding JSON field (quote, snippet, explanation, facts, expected,
 * interpretations, pattern_key) contains the raw digits of a synthetic ABA/DDA. Synthetic,
 * non-routable values only.
 */
const ABA = '990000017';
const DDA = '000111222333';
const LONG = '4'.repeat(40);

const HTML = `<p>Wire instructions</p>
<p>Bank: Example Bank, ABA: ${ABA} and DDA: ${DDA}; reference the investor name [insert investor name].</p>
<p>Account Number: ${LONG}</p>
<p>NTD: confirm routing ${ABA} with the bank.</p>`;

function rawDigits(s: string): string[] {
  return sensitiveSpans(s).map((x) => s.slice(x.start, x.end).replace(/\D/g, ''));
}

describe('sensitive-no-raw (AC10)', () => {
  it('no finding field carries the raw synthetic ABA/DDA/40-digit value', () => {
    const findings = runDeterministic(analyzeHtml(HTML));
    expect(findings.some((f) => f.issue_class === 'sensitive_data')).toBe(true);
    for (const f of findings) {
      const json = JSON.stringify(f);
      for (const raw of [ABA, DDA, LONG]) {
        expect(json).not.toContain(raw);
        expect(json).not.toContain(raw.slice(0, 8));
      }
    }
  });

  it('on samples #1 and #7 no finding field contains any account-like digit run of the source', () => {
    for (const n of [1, 7]) {
      const { g, findings } = analyzed(n);
      const raws = new Set<string>();
      g.structure.blocks.forEach((_, i) => rawDigits(blockText(g, i)).forEach((r) => raws.add(r)));
      for (const f of findings) {
        const text = JSON.stringify([f.quote, f.quote_snippet, f.detail, f.pattern_key]).replace(
          /\D/g,
          ' ',
        );
        for (const r of raws)
          if (r.length >= 6) expect(text.includes(r), `${n}: ${f.id}`).toBe(false);
      }
    }
  });
});
