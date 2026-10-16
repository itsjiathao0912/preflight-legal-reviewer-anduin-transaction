import { describe, expect, it } from 'vitest';
import { checkSpikeRef, SPIKES } from '../src/spikes/spike-check';

const header =
  '| Spike | Verdict | Measured | Fallback adopted | Owner phase |\n|---|---|---|---|---|';
const row = (id: string, verdict = 'PASS', measured = '1 ms') =>
  `| ${id} | ${verdict} | ${measured} | none | 00 |`;
const ref = (rows: string[]) =>
  `# REF\n\n## Spike verdicts\n\n${header}\n${rows.join('\n')}\n\n## Other\n`;

describe('spike:check', () => {
  it('passes a complete ledger', () => {
    expect(checkSpikeRef(ref(SPIKES.map((s) => row(s))))).toEqual([]);
  });

  it('fails when a spike row is missing', () => {
    expect(checkSpikeRef(ref(SPIKES.filter((s) => s !== 'S4').map((s) => row(s))))).toEqual([
      'S4: missing row',
    ]);
  });

  it('fails on an unknown verdict and on empty Measured for PASS rows', () => {
    const rows = SPIKES.map((s) =>
      s === 'S2' ? row(s, 'MAYBE') : s === 'S3' ? row(s, 'PASS-WITH-RISK', '') : row(s),
    );
    expect(checkSpikeRef(ref(rows))).toEqual([
      'S2: unknown verdict "MAYBE"',
      'S3: Measured is empty for PASS-WITH-RISK',
    ]);
  });

  it('accepts DEFERRED(owner) and INCONCLUSIVE-LOCAL with empty Measured', () => {
    const rows = SPIKES.map((s) =>
      s === 'S5'
        ? row(s, 'DEFERRED(04b)', '')
        : s === 'S1'
          ? row(s, 'INCONCLUSIVE-LOCAL', '')
          : row(s),
    );
    expect(checkSpikeRef(ref(rows))).toEqual([]);
  });

  it('fails without the section', () => {
    expect(checkSpikeRef('# nothing')).toEqual(['missing "## Spike verdicts" section']);
  });
});
