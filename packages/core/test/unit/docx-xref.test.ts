import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  docxToLines,
  isHeadingLikeItem,
  numberingLabelFor,
  reconstructNumbering,
  RECONSTRUCTED_NUMBERING_LABEL,
} from '../../src/adapters/docx';
import { buildDocGraph, runDeterministic } from '../../src/engine';

const fixture = () =>
  readFileSync(new URL('../../../../fixtures/docx/legal-numbering.docx', import.meta.url));

describe('docx xref (06d): heading-like numbered items open sections', () => {
  it('marks short top-level items without terminal punctuation as headings', () => {
    expect(isHeadingLikeItem('Definitions and Interpretation')).toBe(true);
    expect(isHeadingLikeItem('The Subscriber represents that it is:')).toBe(false);
    expect(isHeadingLikeItem('x'.repeat(81))).toBe(false);
    const r = reconstructNumbering(
      '<ol><li>Definitions<ol><li>Terms apply.</li></ol></li><li>A long sentence item.</li></ol>',
    );
    expect(r.headings).toBe(1);
    expect(r.html).toContain('<li><strong>1. Definitions</strong><ol>');
    expect(r.html).toContain('<li>2. A long sentence item.</li>');
    expect(r.html).toContain('<li>1.1 Terms apply.</li>');
  });

  it('the legal-numbering fixture yields sections and at least one cross-reference finding', async () => {
    const r = await docxToLines(fixture());
    expect(r.reconstructedNumbering).toBe(true);
    const g = buildDocGraph(r.docHash, r.lines, { bytes: r.bytes, adapter_ms: 0 }, 'docx');
    const headings = g.doc.blocks.filter((b) => b.kind === 'heading').map((b) => b.lines[0]!.text);
    expect(headings).toEqual([
      '1. Definitions and Interpretation',
      '2. Subscription',
      '3. Representations of the Subscriber',
      '4. Commitment',
    ]);
    const xref = runDeterministic(g).filter((f) => f.issue_class === 'broken_cross_reference');
    expect(xref.length).toBeGreaterThanOrEqual(1);
    for (const f of xref) {
      expect(numberingLabelFor(f.issue_class, r.reconstructedNumbering)).toBe(
        RECONSTRUCTED_NUMBERING_LABEL,
      );
    }
    expect(RECONSTRUCTED_NUMBERING_LABEL).toBe('based on reconstructed numbering');
    expect(numberingLabelFor('broken_cross_reference', false)).toBeUndefined();
    expect(numberingLabelFor('sensitive_data', true)).toBeUndefined();
  });
});
