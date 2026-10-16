import { describe, expect, it } from 'vitest';
import { analyzeHtml, runDeterministic } from '../../src/engine';
import { FindingSchema } from '../../src/findings/schema';
import { htmlSamples, readSample } from '../helpers/samples';

/** test:corpus: every HTML sample parses without throwing; informational ceiling < 40 high+critical per doc. */
const files = htmlSamples();

describe('corpus (12 HTML samples)', () => {
  it('has the 12 HTML samples (D-7: 01-08, 10-13)', () => {
    expect(files).toHaveLength(12);
  });

  it.each(files)('%s: no throw, schema-valid findings, < 40 high+critical', (file) => {
    const bytes = readSample(file);
    const t0 = performance.now();
    const g = analyzeHtml(bytes);
    const parseMs = performance.now() - t0;
    const findings = runDeterministic(g);
    expect(g.doc.stage_failed).toBeUndefined();
    expect(g.doc.blocks.length).toBeGreaterThan(20);
    for (const f of findings) expect(FindingSchema.safeParse(f).success).toBe(true);
    const blocking = findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical',
    ).length;
    expect(blocking).toBeLessThan(40);
    const counts: Record<string, number> = {};
    for (const f of findings) counts[f.issue_class] = (counts[f.issue_class] ?? 0) + 1;
    console.info(
      `[corpus] ${file} bytes=${bytes.byteLength} blocks=${g.doc.blocks.length} sections=${g.structure.scopes.reduce((a, s) => a + s.sections.length, 0)} refs=${g.structure.references.length} parse+structure=${parseMs.toFixed(0)}ms findings=${findings.length} ${JSON.stringify(counts)}`,
    );
  });
});
