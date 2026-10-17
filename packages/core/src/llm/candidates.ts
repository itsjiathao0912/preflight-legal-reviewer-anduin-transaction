import { limits } from '../config/limits';
import type { AiCandidate } from '../contracts/ai';
import type { Finding } from '../findings/schema';
import type { IssueClass } from '../findings/taxonomy';
import type { DocGraph } from '../graph/graph';
import { mask, sensitiveSpans } from '../memory/mask';
import { snapToSentence } from '../memory/snap';
import { sha256Hex } from '../model/hash';

/**
 * Graph-selected AI candidates (pure function of the DocGraph plus the deterministic findings).
 * Neighborhoods, in priority order: (1) sentences of deterministic findings, (2) conditional
 * sentences, (3) defined-term definitions, (4) exclusive option-group cue lines. Deduplicated by
 * sentence, masked (no raw account digits leave the browser), capped at `max` (limits.aiCandidates),
 * returned in document order with stable ids.
 */
interface Pick {
  blockIndex: number;
  start: number;
  end: number;
  hint?: IssueClass;
  priority: number;
}

export function buildAiCandidates(
  g: DocGraph,
  findings: readonly Finding[],
  max: number = limits.aiCandidates,
): AiCandidate[] {
  const s = g.structure;
  const cap = Math.max(0, Math.min(max, limits.aiCandidates));
  if (cap === 0) return [];
  const blockIndexById = new Map(s.blocks.map((b, i) => [b.id, i] as const));
  const picks: Pick[] = [];
  for (const f of findings) {
    if (f.detector_kind !== 'rule') continue;
    const bi = blockIndexById.get(f.anchor.blockId);
    if (bi === undefined) continue;
    picks.push({
      blockIndex: bi,
      start: f.anchor.offsetStart,
      end: f.anchor.offsetEnd,
      hint: f.issue_class,
      priority: 0,
    });
  }
  for (const c of s.conditionals)
    picks.push({
      blockIndex: c.blockIndex,
      start: c.start,
      end: c.end,
      hint: 'broken_conditional',
      priority: 1,
    });
  for (const d of s.definedTerms)
    picks.push({
      blockIndex: d.blockIndex,
      start: d.start,
      end: d.end,
      hint: 'defined_term_issue',
      priority: 2,
    });
  for (const o of s.optionGroups) {
    const bi = o.blockIndices[0];
    if (bi === undefined) continue;
    picks.push({ blockIndex: bi, start: 0, end: 1, hint: 'option_gap_overlap', priority: 3 });
  }
  picks.sort((a, b) => a.priority - b.priority || a.blockIndex - b.blockIndex || a.start - b.start);

  const chosen = new Map<string, AiCandidate & { _order: number }>();
  for (const p of picks) {
    if (chosen.size >= cap) break;
    const block = s.blocks[p.blockIndex];
    if (!block || block.kind === 'heading') continue;
    const text = block.lines.map((l) => l.text).join(' ');
    if (text.trim().length === 0) continue;
    const snap = snapToSentence(text, Math.min(p.start, text.length), Math.min(p.end, text.length));
    const quote = mask(snap.quote, sensitiveSpans(snap.quote)).slice(0, limits.quoteMaxChars);
    if (quote.trim().length === 0) continue;
    const key = `${block.id}:${snap.start}`;
    if (chosen.has(key)) continue;
    const c: AiCandidate & { _order: number } = {
      id: 'c_' + sha256Hex(`${s.docHash}|${key}`).slice(0, 16),
      quote,
      section_path: block.section_path.slice(0, 8).map((x) => x.slice(0, 300)),
      _order: p.blockIndex * 1e6 + snap.start,
    };
    if (p.hint) c.issue_class_hint = p.hint;
    chosen.set(key, c);
  }
  return [...chosen.values()].sort((a, b) => a._order - b._order).map(({ _order: _o, ...c }) => c);
}
