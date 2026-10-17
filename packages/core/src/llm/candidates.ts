import { limits } from '../config/limits';
import type { AiCandidate } from '../contracts/ai';
import type { Finding } from '../findings/schema';
import type { IssueClass } from '../findings/taxonomy';
import type { DocGraph } from '../graph/graph';
import { mask, sensitiveSpans } from '../memory/mask';
import { snapToSentence } from '../memory/snap';
import { sha256Hex } from '../model/hash';
import { rangesOverlap } from './dedupe';

/**
 * Graph-selected AI candidates (pure function of the DocGraph plus the deterministic findings).
 * Neighborhoods, in priority order: (1) conditional sentences, (2) defined-term definitions,
 * (3) exclusive option-group cue lines. Sentences that overlap a deterministic (`rule`) finding's
 * anchor are excluded: the rule engine already reports them, so asking the model about them only
 * produces duplicates. Deduplicated by sentence, masked (no raw account digits leave the browser), capped at `max` (limits.aiCandidates),
 * returned in document order with stable ids.
 */
interface Pick {
  blockIndex: number;
  start: number;
  end: number;
  hint?: IssueClass;
  priority: number;
}

/**
 * Where a candidate came from: the snapped sentence range in the document (review M1). The client
 * verify chain only accepts an AI quote found inside the cited candidate's own range.
 */
export interface AiCandidateSite {
  id: string;
  blockIndex: number;
  start: number;
  end: number;
}

export function buildAiCandidates(
  g: DocGraph,
  findings: readonly Finding[],
  max: number = limits.aiCandidates,
): AiCandidate[] {
  return buildAiCandidatesWithSites(g, findings, max).candidates;
}

/** Same selection as `buildAiCandidates`, plus each candidate's document site. */
export function buildAiCandidatesWithSites(
  g: DocGraph,
  findings: readonly Finding[],
  max: number = limits.aiCandidates,
): { candidates: AiCandidate[]; sites: AiCandidateSite[] } {
  const s = g.structure;
  const cap = Math.max(0, Math.min(max, limits.aiCandidates));
  if (cap === 0) return { candidates: [], sites: [] };
  const blockIndexById = new Map(s.blocks.map((b, i) => [b.id, i] as const));
  const ruleSpans = new Map<number, [number, number][]>();
  for (const f of findings) {
    if (f.detector_kind !== 'rule') continue;
    const bi = blockIndexById.get(f.anchor.blockId);
    if (bi === undefined) continue;
    const span: [number, number] = [f.anchor.offsetStart, f.anchor.offsetEnd];
    const list = ruleSpans.get(bi);
    if (list) list.push(span);
    else ruleSpans.set(bi, [span]);
  }
  const picks: Pick[] = [];
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

  const chosen = new Map<string, AiCandidate & { _order: number; _site: AiCandidateSite }>();
  for (const p of picks) {
    if (chosen.size >= cap) break;
    const block = s.blocks[p.blockIndex];
    if (!block || block.kind === 'heading') continue;
    const text = block.lines.map((l) => l.text).join(' ');
    if (text.trim().length === 0) continue;
    const snap = snapToSentence(text, Math.min(p.start, text.length), Math.min(p.end, text.length));
    if (
      ruleSpans.get(p.blockIndex)?.some(([rs, re]) => rangesOverlap(snap.start, snap.end, rs, re))
    )
      continue;
    const quote = mask(snap.quote, sensitiveSpans(snap.quote)).slice(0, limits.quoteMaxChars);
    if (quote.trim().length === 0) continue;
    const key = `${block.id}:${snap.start}`;
    if (chosen.has(key)) continue;
    const id = 'c_' + sha256Hex(`${s.docHash}|${key}`).slice(0, 16);
    const c: AiCandidate & { _order: number; _site: AiCandidateSite } = {
      id,
      quote,
      section_path: block.section_path.slice(0, 8).map((x) => x.slice(0, 300)),
      _order: p.blockIndex * 1e6 + snap.start,
      _site: { id, blockIndex: p.blockIndex, start: snap.start, end: snap.end },
    };
    if (p.hint) c.issue_class_hint = p.hint;
    chosen.set(key, c);
  }
  const ordered = [...chosen.values()].sort((a, b) => a._order - b._order);
  return {
    candidates: ordered.map(({ _order: _o, _site: _s, ...c }) => c),
    sites: ordered.map((c) => c._site),
  };
}
