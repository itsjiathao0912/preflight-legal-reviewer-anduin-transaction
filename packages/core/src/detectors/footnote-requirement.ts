import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { isInvestorGroup } from '../investor/extract';
import type { Detector, ExplainFacts } from './registry';
import { fact, listLabels, maskFacts, textOf, whereOf } from './util';

/**
 * footnote-requirement (high): an option group where some options carry a footnote marker
 * (<sup> text read by the HTML adapter side channel, A3) and sibling options do not.
 * Investor-type groups are left to investor-path-missing-item, which compares only peers of the
 * same family (an Individual never needs the entity-documents footnote). OCR / scanned
 * documents carry no markers yet (Phase 06).
 */
export const FOOTNOTE_REQUIREMENT_ID = 'footnote-requirement';

function explain(f: ExplainFacts): string {
  return `In ${fact(f, 'where', 'the document')} the options ${fact(f, 'marked', 'some options')} carry footnote ${fact(f, 'marker', 'a marker')}, but ${fact(f, 'unmarked', 'a sibling option')} does not, so the footnote requirement is applied inconsistently.`;
}

export const footnoteRequirement: Detector = {
  id: FOOTNOTE_REQUIREMENT_ID,
  class: 'inconsistent_footnote_requirement',
  severity: 'high',
  explain,
  patternKey: () => patternKey(FOOTNOTE_REQUIREMENT_ID, 'sibling-missing'),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const group of g.structure.optionGroups) {
      if (group.options.length < 2 || isInvestorGroup(group)) continue;
      const marked = group.options.filter((o) => o.footnote_marker);
      const unmarked = group.options.filter((o) => !o.footnote_marker);
      if (!marked.length || !unmarked.length) continue;
      const markers = [...new Set(marked.map((o) => o.footnote_marker!))].slice(0, 5);
      const target = unmarked[0]!;
      const text = textOf(g, target.blockIndex);
      const at = Math.max(0, text.indexOf(target.label));
      const facts = maskFacts({
        marker: markers.join(', '),
        marked: listLabels(marked.map((o) => o.label)),
        unmarked: listLabels(unmarked.map((o) => o.label)),
        where: whereOf(g, target.blockIndex),
      });
      out.push(
        buildFinding(g, {
          detectorId: FOOTNOTE_REQUIREMENT_ID,
          issueClass: 'inconsistent_footnote_requirement',
          severity: 'high',
          confidence: 0.7,
          blockIndex: target.blockIndex,
          matchStart: at,
          matchEnd: at + target.label.length,
          explanation: explain(facts),
          facts,
          interpretations: [
            `The footnote was left off ${String(facts.unmarked)} by mistake.`,
            `Only the marked options need the footnote; no change needed.`,
          ],
          expected: `Footnote ${String(facts.marker)} on every option it applies to`,
          patternKey: footnoteRequirement.patternKey(facts),
        }),
      );
    }
    return out;
  },
};
