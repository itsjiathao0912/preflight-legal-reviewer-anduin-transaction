import { describe, expect, it } from 'vitest';
import { analyzed, blockText } from '../helpers/samples';

const PHASE01_DETECTORS = ['ref-this-section', 'ref-label-coherence', 'undefined-term'];

describe('golden-01-this-section-11 (AC11, sample #1)', () => {
  const { g, findings } = analyzed(1);
  const xref = findings.filter((f) => f.issue_class === 'broken_cross_reference');

  it('accepts Qualified Client Status as section 12 (bold number + bold title in one row)', () => {
    const body = g.structure.scopes.find((s) => s.sections.some((x) => x.number === '12'))!;
    const s12 = body.sections.find((s) => s.number === '12')!;
    expect(s12.title).toMatch(/^Qualified Client Status/);
    expect(body.sections.map((s) => s.number).slice(0, 13)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
    ]);
  });

  it('should flag "this Section 11" in Section 12 as expected Section 12', () => {
    expect(xref).toHaveLength(2);
    for (const f of xref) {
      expect(f.detector_id).toBe('ref-this-section');
      expect(f.quote).toContain('this Section 11');
      expect(f.detail.facts.cited_section).toBe('11');
      expect(f.detail.facts.enclosing_section).toBe('12');
      expect(f.detail.facts.expected).toBe('12');
      expect(f.detail.expected).toMatch(/^Section 12 \(Qualified Client Status/);
      expect(f.section_path.join(' > ')).toMatch(/^12\. Qualified Client Status/);
      // demo-readiness 17-10-26: a body representation paragraph (no instructions scope, option
      // or conditional) -> stays high; the investor still answers Section 12's own tests.
      expect(f.detail.facts.routing_context).toBe('none');
      expect(f.severity).toBe('high');
    }
  });

  it('should not flag "this Section 9" inside Acknowledgments item 9 on sample 1', () => {
    const nine = g.structure.references.filter(
      (r) => r.form === 'this_section' && r.sectionNumber === '9',
    );
    expect(nine).toHaveLength(2);
    for (const r of nine) {
      // guard (a): no accepted section encloses these continuation paragraphs (they precede bold "1.")
      expect(g.structure.info[r.blockIndex]!.section).toBeUndefined();
      expect(blockText(g, r.blockIndex)).toContain('this Section 9');
    }
    expect(findings.some((f) => f.quote.includes('this Section 9'))).toBe(false);
  });

  it('keeps the non-bold 1-22 accredited list and Acknowledgments 1-13 inert (zero section nodes)', () => {
    const sectionBlocks = new Set(
      g.structure.scopes.flatMap((s) => s.sections.map((x) => x.blockIndex)),
    );
    const s11 = g.structure.scopes.flatMap((s) => s.sections).find((s) => s.number === '11')!;
    const s12 = g.structure.scopes.flatMap((s) => s.sections).find((s) => s.number === '12')!;
    const inner: number[] = [];
    for (let i = s11.blockIndex + 1; i < s12.blockIndex; i++)
      if (/^\d{1,2}\. /.test(blockText(g, i))) inner.push(i);
    expect(inner).toHaveLength(22);
    for (const i of inner) {
      expect(sectionBlocks.has(i)).toBe(false);
      expect(g.structure.blocks[i]!.kind).toBe('list_item');
    }
    const ack = g.structure.references.filter(
      (r) => r.form === 'this_section' && r.sectionNumber === '9',
    );
    const firstSection = Math.min(...sectionBlocks);
    const ackItems: number[] = [];
    for (let i = 0; i < firstSection; i++)
      if (/^\d{1,2}\. /.test(blockText(g, i))) ackItems.push(i);
    expect(ackItems).toHaveLength(13);
    for (const i of ackItems) expect(g.structure.blocks[i]!.kind).toBe('list_item');
    expect(ack.every((r) => r.blockIndex < firstSection)).toBe(true);
  });

  it('negative: no other broken_cross_reference or defined_term_issue on #1', () => {
    expect(findings.filter((f) => f.issue_class === 'defined_term_issue')).toHaveLength(0);
    // Phase 02 (E2): "no other finding" holds for the Phase 01 detector ids; the AC10 flags
    // (sensitive ABA/DDA on #1) are legitimate new findings covered by their own tests.
    expect(findings.filter((f) => PHASE01_DETECTORS.includes(f.detector_id))).toHaveLength(2);
  });
});
