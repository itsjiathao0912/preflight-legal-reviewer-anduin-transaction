import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { labelOf } from '../structure/headings';
import type { Detector, ExplainFacts } from './registry';
import { fact, refRoutingContext, refSeverity } from './util';

/**
 * R. ref-this-section (AC11): "this Section N" whose cited N differs from the
 * enclosing accepted section. Guards: (a) no enclosing accepted section -> no finding
 * (implemented first, E8); (b) a list item citing its own list number -> no finding.
 */
export const REF_THIS_SECTION_ID = 'ref-this-section';

function explain(f: ExplainFacts): string {
  return `The text says "${fact(f, 'reference', 'this Section')}" but it sits in Section ${fact(f, 'enclosing_section', '(unknown)')} (${fact(f, 'enclosing_title', 'untitled')}); a self-reference should cite Section ${fact(f, 'expected', 'the enclosing section')}.`;
}

export const refThisSection: Detector = {
  id: REF_THIS_SECTION_ID,
  class: 'broken_cross_reference',
  // maximum: critical in a routing context (instructions / answer option / conditional), else high
  severity: 'critical',
  explain,
  patternKey: () => patternKey(REF_THIS_SECTION_ID, 'this-section'),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const r of g.structure.references) {
      if (r.form !== 'this_section' || !r.sectionNumber) continue;
      const info = g.structure.info[r.blockIndex]!;
      // guard (a): no accepted section encloses the block
      const enc = info.section;
      if (!enc) continue;
      // guard (b): list item citing its own list number
      const block = g.structure.blocks[r.blockIndex]!;
      if (block.kind === 'list_item' && info.listNumber === r.sectionNumber) continue;
      if (r.sectionNumber === enc.number) continue;
      const ctx = refRoutingContext(g, r.blockIndex);
      const facts: ExplainFacts = {
        reference: r.ref.text,
        cited_section: r.sectionNumber,
        enclosing_section: enc.number,
        enclosing_title: labelOf(enc.title),
        expected: enc.number,
        routing_context: ctx ?? 'none',
      };
      r.ref.status = 'suspicious';
      r.ref.expected = { sectionNumber: enc.number, label: labelOf(enc.title) };
      out.push(
        buildFinding(g, {
          detectorId: REF_THIS_SECTION_ID,
          issueClass: 'broken_cross_reference',
          severity: refSeverity(ctx),
          confidence: 0.9,
          blockIndex: r.blockIndex,
          matchStart: r.start,
          matchEnd: r.end,
          explanation: explain(facts),
          facts,
          expected: `Section ${enc.number} (${labelOf(enc.title)})`,
          patternKey: refThisSection.patternKey(facts),
        }),
      );
    }
    return out;
  },
};
