import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { Detector, ExplainFacts } from './registry';
import { fact, groupBySentence, maskFacts, textOf, whereOf } from './util';

/**
 * flag-placeholder (AC10): unfilled bracket placeholders: `[xx]`, `[insert ...]`, `[●]`/`[•]`.
 * Never `____` blanks (fields) or `[ ]` checkboxes (normalized to ☐ by the adapter);
 * `[***]` redactions are not findings (info only).
 */
export const FLAG_PLACEHOLDER_ID = 'flag-placeholder';
/** Bounded: `[xx]` (2-6 x), `[insert ...]` (<= 60 chars, no nested bracket), bullets. */
export const PLACEHOLDER_RE = /\[(?:[xX]{2,6}|[Ii]nsert\b[^\][]{0,60}|\s?[●•]\s?)\]/g;

export type PlaceholderShape = 'xx' | 'insert' | 'bullet';

export function placeholderShape(token: string): PlaceholderShape {
  if (/^\[\s?[●•]/.test(token)) return 'bullet';
  if (/^\[[Ii]nsert/.test(token)) return 'insert';
  return 'xx';
}

function explain(f: ExplainFacts): string {
  return `The text still contains the placeholder ${fact(f, 'placeholder', '[ ]')} in ${fact(f, 'where', 'the document')} (${fact(f, 'count', '1')} in this sentence). A placeholder means a value was never filled in.`;
}

export const flagPlaceholder: Detector = {
  id: FLAG_PLACEHOLDER_ID,
  class: 'placeholder',
  severity: 'medium',
  explain,
  patternKey: (f) => patternKey(FLAG_PLACEHOLDER_ID, String(f.shape ?? 'xx')),
  run(g: DocGraph): Finding[] {
    const hits: Array<{ blockIndex: number; start: number; end: number; item: string }> = [];
    g.structure.blocks.forEach((_, bi) => {
      const text = textOf(g, bi);
      for (const m of text.matchAll(PLACEHOLDER_RE)) {
        hits.push({ blockIndex: bi, start: m.index!, end: m.index! + m[0].length, item: m[0] });
      }
    });
    return groupBySentence(g, hits).map((h) => {
      const first = h.items[0]!;
      const facts = maskFacts({
        placeholder: first.replace(/\s+/g, ' '),
        shape: placeholderShape(first),
        where: whereOf(g, h.blockIndex),
        count: h.items.length,
      });
      return buildFinding(g, {
        detectorId: FLAG_PLACEHOLDER_ID,
        issueClass: 'placeholder',
        severity: 'medium',
        confidence: 0.9,
        blockIndex: h.blockIndex,
        matchStart: h.matchStart,
        matchEnd: h.matchEnd,
        explanation: explain(facts),
        facts,
        expected: 'Replace the placeholder with the final value',
        patternKey: flagPlaceholder.patternKey(facts),
      });
    });
  },
};
