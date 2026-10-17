import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docxToLines, RECONSTRUCTED_NUMBERING_LABEL } from '../../src/adapters/docx';
import { buildDocGraph, runDeterministic } from '../../src/engine';
import { CoreError } from '../../src/model/errors';

const DIR = join(__dirname, '../../../../fixtures/docx');
const fx = (name: string) => new Uint8Array(readFileSync(join(DIR, name)));

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(CoreError);
    expect((e as CoreError).message.length).toBeGreaterThan(10);
    return (e as CoreError).code;
  }
  throw new Error('expected a CoreError');
}

describe('ingest-all-formats (DOCX)', () => {
  it('should open a docx fixture through mammoth and the HTML adapter', async () => {
    const r = await docxToLines(fx('legal-numbering.docx'));
    const texts = r.lines.map((l) => l.text);
    expect(texts[0]).toBe('SUBSCRIPTION AGREEMENT');
    expect(r.reconstructedNumbering).toBe(true);
    expect(r.notice).toMatch(/reconstructed/);
    expect(r.docHash).toMatch(/^[0-9a-f]{64}$/);
    expect(RECONSTRUCTED_NUMBERING_LABEL).toBe('based on reconstructed numbering');
    const g = buildDocGraph(
      r.docHash,
      r.lines,
      { bytes: r.bytes, adapter_ms: r.adapter_ms },
      'docx',
    );
    expect(g.doc.stage_failed).toBeUndefined();
    expect(g.doc.blocks.length).toBeGreaterThan(5);
    // the reconstructed labels reach the graph ("complete Section 3.1" -> conditional edge)
    expect(g.graph.edges.length).toBeGreaterThan(0);
    expect(() => runDeterministic(g)).not.toThrow();
  });
  it('should reject a corrupt file with a clear message', async () => {
    expect(await codeOf(docxToLines(fx('corrupt.docx')))).toBe('unsupported_type');
  });
  it('should reject an empty file with a clear message', async () => {
    expect(await codeOf(docxToLines(fx('empty.docx')))).toBe('unsupported_type');
  });
  it('should reject a non-zip file and a zip without word/document.xml', async () => {
    expect(await codeOf(docxToLines(new TextEncoder().encode('<html>not a docx</html>')))).toBe(
      'unsupported_type',
    );
  });
});
