import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { investorModelOf } from '../investor/paths';
import type { InvestorPath } from '../investor/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, groupBySentence, maskFacts, textOf, whereOf } from './util';

/**
 * investor-path-dead-end (critical, AC62): an investor type whose route never reaches the
 * completion node (signature). Only when the graph proves it; uncertain paths are never asserted.
 */
export const INVESTOR_PATH_DEAD_END_ID = 'investor-path-dead-end';

function explain(f: ExplainFacts): string {
  return `For investor type "${fact(f, 'investor_type', 'this type')}" the form ${fact(f, 'reason', 'has no complete route')}. The instruction "${fact(f, 'clause', 'cited clause')}" in ${fact(f, 'where', 'the document')} causes it.`;
}

export const investorPathDeadEnd: Detector = {
  id: INVESTOR_PATH_DEAD_END_ID,
  class: 'investor_path_dead_end',
  severity: 'critical',
  explain,
  patternKey: (f) => patternKey(INVESTOR_PATH_DEAD_END_ID, String(f.type_id ?? 'type')),
  run(g: DocGraph): Finding[] {
    const hits: Array<{ blockIndex: number; start: number; end: number; item: InvestorPath }> = [];
    for (const p of investorModelOf(g).paths) {
      if (p.reachesCompletion || p.uncertain || !p.deadEnd) continue;
      const c = p.deadEnd.citation;
      const len = textOf(g, c.blockIndex).length;
      hits.push({
        blockIndex: c.blockIndex,
        start: Math.min(c.start, len),
        end: Math.min(c.end, len),
        item: p,
      });
    }
    return groupBySentence(g, hits).map((h) => {
      const first = h.items[0]!;
      const facts = maskFacts({
        investor_type: h.items.map((p) => p.label).join(', '),
        type_id: h.items.map((p) => p.type).join('-'),
        reason: first.deadEnd!.reason,
        clause: first.deadEnd!.citation.text,
        where: whereOf(g, h.blockIndex),
      });
      return buildFinding(g, {
        detectorId: INVESTOR_PATH_DEAD_END_ID,
        issueClass: 'investor_path_dead_end',
        severity: 'critical',
        confidence: 0.8,
        blockIndex: h.blockIndex,
        matchStart: h.matchStart,
        matchEnd: h.matchEnd,
        explanation: explain(facts),
        facts,
        expected: `A route for "${String(facts.investor_type)}" that reaches the signature`,
        patternKey: investorPathDeadEnd.patternKey(facts),
      });
    });
  },
};
