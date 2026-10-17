import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../../src/engine';
import { diffDocuments, type SideInput } from '../../../src/diff/index';
import { readSample } from '../../helpers/samples';

/**
 * AC29 (D7) Node probe: end-to-end diff INCLUDING both parses and both runDeterministic runs,
 * alignment and text diff, measured by the test's own timer (timing is never in DiffResult).
 * The worker-side timing is asserted by the web e2e `diff-pairs` (07b).
 */
function prepare(bytes: Uint8Array): SideInput {
  const g = analyzeHtml(bytes);
  return { ok: true, structure: g.structure, graph: g, findings: runDeterministic(g) };
}

function timed(a: number, b: number): number {
  const ba = readSample(a);
  const bb = readSample(b);
  const t0 = performance.now();
  const o = diffDocuments({ a: prepare(ba), b: prepare(bb), mode: 'version' });
  const ms = performance.now() - t0;
  expect('result' in o).toBe(true);
  return ms;
}

describe('diff-perf', () => {
  it('should finish a 5 vs 6 diff in under 3 seconds', () => {
    timed(5, 6); // warm-up (JIT), not asserted
    const ms56 = timed(5, 6);
    const ms22 = timed(2, 2);
    console.log(`diff-perf: #5 vs #6 ${Math.round(ms56)} ms; #2 vs #2 ${Math.round(ms22)} ms`);
    expect(ms56).toBeLessThan(3000);
    expect(ms22).toBeLessThan(3000);
  });
});
