import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { Detector, ExplainFacts } from './registry';
import { fact, groupBySentence, maskFacts, maskText, maskThenClip, textOf, whereOf } from './util';

/**
 * flag-drafting-note (AC10): internal drafting notes left in the document ("NTD:",
 * "Drafting note", "Note to draft"). Medium: never blocks digitization on its own.
 */
export const FLAG_DRAFTING_NOTE_ID = 'flag-drafting-note';
/** Bounded, linear: fixed alternatives, one optional space run of at most 3. */
export const DRAFTING_NOTE_RE = /\b(NTD\s{0,3}:|Drafting [Nn]ote|DRAFTING NOTE|Note to [Dd]raft)/g;

function explain(f: ExplainFacts): string {
  return `The text contains an internal drafting note marked "${fact(f, 'marker', 'drafting note')}" in ${fact(f, 'where', 'the document')}: "${fact(f, 'note', 'no text')}". Drafting notes must be removed before the form is digitized.`;
}

export const flagDraftingNote: Detector = {
  id: FLAG_DRAFTING_NOTE_ID,
  class: 'drafting_note',
  severity: 'medium',
  explain,
  patternKey: (f) =>
    patternKey(FLAG_DRAFTING_NOTE_ID, /ntd/i.test(String(f.marker ?? '')) ? 'ntd' : 'note'),
  run(g: DocGraph): Finding[] {
    const hits: Array<{ blockIndex: number; start: number; end: number; item: string }> = [];
    g.structure.blocks.forEach((_, bi) => {
      const text = textOf(g, bi);
      for (const m of text.matchAll(DRAFTING_NOTE_RE)) {
        hits.push({ blockIndex: bi, start: m.index!, end: m.index! + m[0].length, item: m[1]! });
      }
    });
    return groupBySentence(g, hits).map((h) => {
      const text = textOf(g, h.blockIndex);
      const marker = h.items[0]!.replace(/\s+/g, ' ').replace(/\s*:$/, ':');
      const note = maskThenClip(text.slice(h.matchEnd, h.end), 160).trim();
      const facts = maskFacts({
        marker,
        note: note || '(empty)',
        where: whereOf(g, h.blockIndex),
        count: h.items.length,
      });
      return buildFinding(g, {
        detectorId: FLAG_DRAFTING_NOTE_ID,
        issueClass: 'drafting_note',
        severity: 'medium',
        confidence: 0.95,
        blockIndex: h.blockIndex,
        matchStart: h.matchStart,
        matchEnd: h.matchEnd,
        explanation: explain(facts),
        facts,
        expected: maskText('Remove the drafting note before the form is digitized'),
        patternKey: flagDraftingNote.patternKey(facts),
      });
    });
  },
};
