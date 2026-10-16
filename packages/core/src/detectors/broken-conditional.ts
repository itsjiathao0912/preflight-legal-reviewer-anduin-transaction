import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { checkTarget, conditionalTargets, isFlowAction } from './flow';
import type { Detector, ExplainFacts } from './registry';
import { fact, maskFacts, textOf, whereOf, maskThenClip } from './util';

/**
 * broken-conditional (critical): a conditional instruction ("If ..., complete / skip / proceed to
 * Section N") whose target section or part does not exist. Uncertain targets (no structural
 * evidence) never produce a finding.
 */
export const BROKEN_CONDITIONAL_ID = 'broken-conditional';

function explain(f: ExplainFacts): string {
  return `The instruction "${fact(f, 'instruction', 'conditional instruction')}" in ${fact(f, 'where', 'the document')} sends the reader to ${fact(f, 'target', 'a target')}, but ${fact(f, 'missing', 'that target')} does not exist in this document.`;
}

export const brokenConditional: Detector = {
  id: BROKEN_CONDITIONAL_ID,
  class: 'broken_conditional',
  severity: 'critical',
  explain,
  patternKey: (f) => patternKey(BROKEN_CONDITIONAL_ID, `${String(f.action ?? 'go')}-missing`),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const c of g.structure.conditionals) {
      if (!isFlowAction(c)) continue;
      for (const t of conditionalTargets(g, c)) {
        const chk = checkTarget(g, c, t);
        if (chk.status !== 'missing') continue;
        const facts = maskFacts({
          instruction: maskThenClip(c.text, 200),
          action: c.action,
          target: t.raw,
          missing: chk.missing ?? t.raw,
          where: whereOf(g, c.blockIndex),
        });
        const text = textOf(g, c.blockIndex);
        const at = text.indexOf(t.raw.split(' of ')[0]!, c.start);
        out.push(
          buildFinding(g, {
            detectorId: BROKEN_CONDITIONAL_ID,
            issueClass: 'broken_conditional',
            severity: 'critical',
            confidence: 0.85,
            blockIndex: c.blockIndex,
            matchStart: at >= c.start ? at : c.start,
            matchEnd: at >= c.start ? at + t.raw.length : c.end,
            explanation: explain(facts),
            facts,
            interpretations: [
              `The target was renumbered and the instruction should point to the new number.`,
              `The ${String(facts.missing)} is missing from this version of the form.`,
            ],
            expected: `An existing target for "${String(facts.target)}"`,
            patternKey: brokenConditional.patternKey(facts),
          }),
        );
        break; // one finding per instruction (finding ids are sentence-anchored)
      }
    }
    return out;
  },
};
