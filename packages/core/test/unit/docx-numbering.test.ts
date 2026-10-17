import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docxToLines, numberLabel, reconstructNumbering } from '../../src/adapters/docx';

const FIXTURE = join(__dirname, '../../../../fixtures/docx/legal-numbering.docx');

describe('docx numbering reconstruction', () => {
  it('labels legal levels 1. / 1.1 / (a) / (i)', () => {
    expect(numberLabel([3])).toBe('3.');
    expect(numberLabel([2, 4])).toBe('2.4');
    expect(numberLabel([2, 2, 2])).toBe('(b)');
    expect(numberLabel([1, 1, 1, 4])).toBe('(iv)');
    expect(numberLabel([1, 1, 1, 1, 27])).toBe('(AA)');
    expect(numberLabel([1, 1, 1, 1, 1, 7])).toBe('(7)');
  });
  it('prefixes ol items, skips ul items, restarts counters per list and escapes text', () => {
    const r = reconstructNumbering(
      '<ol><li>A<ol><li>B</li><li>C &amp; D</li></ol></li><li>E</li></ol><ul><li>x</li></ul><ol><li>F</li></ol>',
    );
    expect(r.html).toBe(
      // 06d: short top-level items without terminal punctuation are heading-like (<strong>)
      '<ol><li><strong>1. A</strong><ol><li>1.1 B</li><li>1.2 C &amp; D</li></ol></li><li><strong>2. E</strong></li></ol><ul><li>x</li></ul><ol><li><strong>1. F</strong></li></ol>',
    );
    expect(r.headings).toBe(3);
    expect(r.labelled).toBe(5);
    expect(r.items).toBe(6);
  });
  it('reconstructs the fixture numbering as line prefixes', async () => {
    const texts = (await docxToLines(new Uint8Array(readFileSync(FIXTURE)))).lines.map(
      (l) => l.text,
    );
    expect(texts).toContain('1. Definitions and Interpretation');
    expect(texts).toContain('2.2 The Subscriber represents that it is:');
    expect(texts.some((t) => t.startsWith('(a) an accredited investor, see Section 2(b)'))).toBe(
      true,
    );
    expect(texts.some((t) => t.startsWith('(ii) an entity acting'))).toBe(true);
    expect(texts).toContain('4. Commitment');
  });
  it('reports no reconstructed numbering for a list-free document', () => {
    const r = reconstructNumbering('<h1>T</h1><p>x</p>');
    expect(r.labelled).toBe(0);
  });
  it('caps list nesting depth (no labels beyond the frame cap, no throw)', () => {
    const deep = '<ol><li>'.repeat(400) + 'x' + '</li></ol>'.repeat(400);
    const r = reconstructNumbering(deep);
    expect(r.labelled).toBe(256);
  });
});
