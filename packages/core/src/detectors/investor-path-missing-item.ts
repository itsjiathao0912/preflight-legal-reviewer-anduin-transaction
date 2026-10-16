import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { investorModelOf } from '../investor/paths';
import { TYPE_LABELS, type InvestorPath, type PathGap } from '../investor/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, groupBySentence, maskFacts, textOf, whereOf } from './util';

/**
 * investor-path-missing-item (high, AC62): a required item is missing from a type's path:
 *  - part-c: the type is told to "also complete Part C" but Part C does not exist or its section
 *    is skipped for that type;
 *  - peer-item (app.html PATH-04): peers of the same family carry an item (footnote 2) this type lacks.
 */
export const INVESTOR_PATH_MISSING_ITEM_ID = 'investor-path-missing-item';

function explain(f: ExplainFacts): string {
  if (f.kind === 'peer-item')
    return `Investor type "${fact(f, 'investor_type', 'this type')}" has no ${fact(f, 'item', 'item')}, but its peers (${fact(f, 'peers', 'other types')}) carry it in ${fact(f, 'where', 'the document')}. Either it was left off or this type answers differently.`;
  return `Investor type "${fact(f, 'investor_type', 'this type')}" must complete ${fact(f, 'item', 'an item')}, but that item is not on its path. The instruction "${fact(f, 'clause', 'cited clause')}" in ${fact(f, 'where', 'the document')} requires it.`;
}

export const investorPathMissingItem: Detector = {
  id: INVESTOR_PATH_MISSING_ITEM_ID,
  class: 'investor_path_missing_item',
  severity: 'high',
  explain,
  patternKey: (f) =>
    patternKey(
      INVESTOR_PATH_MISSING_ITEM_ID,
      `${String(f.kind ?? 'item')}:${String(f.type_id ?? 'type')}`,
    ),
  run(g: DocGraph): Finding[] {
    const hits: Array<{
      blockIndex: number;
      start: number;
      end: number;
      item: { p: InvestorPath; gap: PathGap };
    }> = [];
    for (const p of investorModelOf(g).paths)
      for (const gap of p.gaps) {
        const len = textOf(g, gap.citation.blockIndex).length;
        hits.push({
          blockIndex: gap.citation.blockIndex,
          start: Math.min(gap.citation.start, len),
          end: Math.min(gap.citation.end, len),
          item: { p, gap },
        });
      }
    return groupBySentence(g, hits).map((h) => {
      const { gap } = h.items[0]!;
      const types = h.items.map((x) => x.p);
      const facts = maskFacts({
        kind: gap.kind,
        investor_type: [...new Set(types.map((p) => p.label))].join(', '),
        type_id: types.map((p) => p.type).join('-'),
        item: gap.item,
        peers: [...new Set(gap.peers.map((x) => TYPE_LABELS[x]))].join(', '),
        clause: gap.citation.text,
        where: whereOf(g, h.blockIndex),
      });
      return buildFinding(g, {
        detectorId: INVESTOR_PATH_MISSING_ITEM_ID,
        issueClass: 'investor_path_missing_item',
        severity: 'high',
        confidence: gap.kind === 'peer-item' ? 0.7 : 0.8,
        blockIndex: h.blockIndex,
        matchStart: h.matchStart,
        matchEnd: h.matchEnd,
        explanation: explain(facts),
        facts,
        interpretations:
          gap.kind === 'peer-item'
            ? [
                `The ${gap.item} was left off this type by mistake.`,
                `This type is meant to answer differently; no change needed.`,
              ]
            : [],
        expected: `${String(facts.item)} on the path for "${String(facts.investor_type)}"`,
        patternKey: investorPathMissingItem.patternKey(facts),
      });
    });
  },
};
