import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { htmlSamples, readSample } from '../helpers/samples';

/** determinism-repeat-run (AC8): N=5 fresh runs are byte-equal. */
describe('determinism-repeat-run (AC8)', () => {
  it.each(htmlSamples())('%s: 5 runs give byte-equal findings and structure', (file) => {
    const bytes = readSample(file);
    const runs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const g = analyzeHtml(bytes);
      const findings = runDeterministic(g);
      runs.push(
        JSON.stringify({
          findings,
          blocks: g.doc.blocks,
          graph: g.graph,
          refs: g.structure.references.map((r) => r.ref),
        }),
      );
    }
    for (const r of runs) expect(r).toBe(runs[0]);
  });

  it('anchors are stable across runs (same block id and offsets)', () => {
    const a = runDeterministic(analyzeHtml(readSample(1)));
    const b = runDeterministic(analyzeHtml(readSample(1)));
    expect(a.map((f) => [f.id, f.anchor])).toEqual(b.map((f) => [f.id, f.anchor]));
  });
});
