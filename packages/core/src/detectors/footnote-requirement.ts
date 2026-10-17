import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { isInvestorGroup, peerMarkerGaps } from '../investor/extract';
import { investorModelOf } from '../investor/paths';
import { TYPE_LABELS } from '../investor/types';
import type { OptionGroup } from '../structure/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, listLabels, maskFacts, textOf, whereOf } from './util';

/**
 * footnote-requirement (high): an option group where some options carry a footnote marker
 * (superscript side channel `adapters/sup-segments.ts`: <sup> from the HTML adapter, `^{n}` from
 * the OCR adapter, A3 / Phase 06 D2) and sibling options do not.
 * Investor-type groups are left to investor-path-missing-item, which compares only peers of the
 * same family (an Individual never needs the entity-documents footnote). Exception (Phase 06 D2,
 * probe-first): an OCR-provenance investor group is checked here with the same PATH-04 peer rule
 * (`peerMarkerGaps`), because OCR text has no heading cues, so a scanned page usually has no
 * numbered main scope and PATH-04 cannot run. Options PATH-04 already reports are skipped and the
 * group yields at most one finding, so a group is never reported twice. HTML is unchanged.
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
      if (group.options.length < 2) continue;
      if (isInvestorGroup(group)) {
        if (isOcrGroup(g, group)) {
          const f = ocrInvestorFinding(g, group);
          if (f) out.push(f);
        }
        continue;
      }
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

/** Every line of every block in the group came from the OCR adapter. */
function isOcrGroup(g: DocGraph, group: OptionGroup): boolean {
  return group.blockIndices.every((bi) =>
    g.structure.blocks[bi]!.lines.every((l) => l.cue.cue_source === 'ocr'),
  );
}

/** One finding per OCR investor group from the PATH-04 peer rule, minus options PATH-04 reports. */
function ocrInvestorFinding(g: DocGraph, group: OptionGroup): Finding | undefined {
  const reported = new Set<string>();
  for (const p of investorModelOf(g).paths)
    for (const gap of p.gaps)
      if (gap.kind === 'peer-item') reported.add(`${gap.citation.blockIndex}|${gap.citation.text}`);
  const gaps = peerMarkerGaps(group, { distinctPeers: true }).filter(
    (x) => !reported.has(`${x.option.blockIndex}|${x.option.label.slice(0, 200)}`),
  );
  if (!gaps.length) return undefined;
  const first = gaps[0]!;
  const markers = [...new Set(gaps.map((x) => x.marker))].slice(0, 5);
  const marked = [...new Set(gaps.flatMap((x) => x.carriers))];
  const peerLabels = new Set(first.peers.map((t) => TYPE_LABELS[t]));
  const target = first.option;
  const text = textOf(g, target.blockIndex);
  const at = Math.max(0, text.indexOf(target.label));
  const facts = maskFacts({
    marker: markers.join(', '),
    marked: listLabels(marked.map((o) => o.label)),
    unmarked: listLabels([...new Set(gaps.map((x) => x.option.label))]),
    peers: [...peerLabels].join(', '),
    provenance: 'ocr',
    where: whereOf(g, target.blockIndex),
  });
  return buildFinding(g, {
    detectorId: FOOTNOTE_REQUIREMENT_ID,
    issueClass: 'inconsistent_footnote_requirement',
    severity: 'high',
    confidence: 0.6,
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
  });
}
