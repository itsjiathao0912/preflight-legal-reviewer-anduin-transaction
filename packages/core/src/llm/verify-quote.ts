import { limits } from '../config/limits';
import { AiFindingSchema, type AiTaskId } from '../contracts/ai';
import { maskText } from '../detectors/util';
import { findingId } from '../findings/ids';
import { FindingSchema, type Finding } from '../findings/schema';
import { capSeverity, maxSeverityFor } from '../findings/severity';
import type { DocGraph } from '../graph/graph';
import { quoteHash } from '../memory/fingerprint';
import { mask, sensitiveSpans } from '../memory/mask';
import { snapToSentence } from '../memory/snap';
import { makeAnchor } from '../model/anchors';
import { AI_SUGGESTION_LABEL, type AiSource } from './provenance';

/**
 * Client verify chain for AI results (runs in the engine worker, G12):
 * envelope check -> per-finding schema -> locate quote (case / whitespace / quote-style tolerant)
 * -> reject + log if unlocatable -> snapToSentence (memory/snap.ts) -> severity cap (AI <= high)
 * -> mask BEFORE hashing -> schema-valid Finding. The fingerprint quote is always the document's
 * own sentence, never the model's wording. Cached results go through the same chain on open.
 */

/** One normalized character and the original UTF-16 range it came from. */
interface NormText {
  text: string;
  /** origStart[i] / origEnd[i]: original [start, end) of normalized char i. */
  origStart: number[];
  origEnd: number[];
}

const DROP = /[\u00ad\u200b-\u200d\u2060\ufeff]/;
const QUOTE_MAP: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '′': "'",
  '`': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '″': '"',
  '–': '-',
  '—': '-',
  '\u2011': '-',
};

/** Tolerant normalization with an index map back to the original text. */
export function normalizeForLocate(s: string): NormText {
  let text = '';
  const origStart: number[] = [];
  const origEnd: number[] = [];
  let pendingSpace = -1;
  let i = 0;
  for (const ch of s) {
    const start = i;
    i += ch.length;
    if (DROP.test(ch)) continue;
    if (/\s/u.test(ch)) {
      if (text.length > 0 && pendingSpace < 0) pendingSpace = start;
      continue;
    }
    if (pendingSpace >= 0) {
      text += ' ';
      origStart.push(pendingSpace);
      origEnd.push(start);
      pendingSpace = -1;
    }
    const mapped = (QUOTE_MAP[ch] ?? ch).normalize('NFC').toLowerCase();
    for (const c of mapped) {
      text += c;
      origStart.push(start);
      origEnd.push(i);
    }
  }
  return { text, origStart, origEnd };
}

/** Strip wrapping quotes / ellipses the model often adds around a copied passage. */
function trimQuote(q: string): string {
  return q
    .trim()
    .replace(/^(?:["'‘’“”]|\.\.\.|…)+/u, '')
    .replace(/(?:["'‘’“”]|\.\.\.|…)+$/u, '')
    .trim();
}

export interface QuoteLocation {
  blockIndex: number;
  start: number;
  end: number;
}

const cache = new WeakMap<DocGraph, NormText[]>();

function normBlocks(g: DocGraph): NormText[] {
  let hit = cache.get(g);
  if (!hit) {
    hit = g.structure.blocks.map((b) => normalizeForLocate(b.lines.map((l) => l.text).join(' ')));
    cache.set(g, hit);
  }
  return hit;
}

/** Locate a model quote in the document; null when it does not literally appear (tolerantly). */
export function locateQuote(g: DocGraph, quote: string): QuoteLocation | null {
  const q = normalizeForLocate(trimQuote(quote)).text;
  if (q.length === 0) return null;
  const blocks = normBlocks(g);
  for (let bi = 0; bi < blocks.length; bi++) {
    const n = blocks[bi]!;
    const at = n.text.indexOf(q);
    if (at < 0) continue;
    return { blockIndex: bi, start: n.origStart[at]!, end: n.origEnd[at + q.length - 1]! };
  }
  return null;
}

export type AiRejectReason = 'schema' | 'quote_too_long' | 'quote_not_found' | 'invalid_finding';

export interface RejectedAiFinding {
  candidate_id?: string;
  reason: AiRejectReason;
}

export type VerifyAiOutcome =
  | { ok: true; findings: Finding[]; rejected: RejectedAiFinding[] }
  | { ok: false; reason: 'schema' };

export interface VerifyAiContext {
  model: string;
  provenance: AiSource;
  task?: AiTaskId;
}

function snippet(q: string): string {
  const max = limits.snippetMaxChars;
  return q.length <= max ? q : q.slice(0, max - 1) + '…';
}

function clampText(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Verify an AI result against the analyzed document. Never throws on hostile input. */
export function verifyAiResult(
  g: DocGraph,
  result: unknown,
  ctx: VerifyAiContext,
): VerifyAiOutcome {
  if (!isRecord(result) || result['v'] !== 1 || !Array.isArray(result['findings']))
    return { ok: false, reason: 'schema' };
  const task = ctx.task ?? 'clause-judgment';
  const detectorId = `ai:${task}`;
  const findings: Finding[] = [];
  const rejected: RejectedAiFinding[] = [];
  const seen = new Set<string>();
  for (const raw of result['findings'] as unknown[]) {
    const cid =
      isRecord(raw) && typeof raw['candidate_id'] === 'string'
        ? raw['candidate_id'].slice(0, 64)
        : undefined;
    const tag = cid !== undefined ? { candidate_id: cid } : {};
    if (
      isRecord(raw) &&
      typeof raw['quote'] === 'string' &&
      raw['quote'].length > limits.quoteMaxChars
    ) {
      rejected.push({ ...tag, reason: 'quote_too_long' });
      continue;
    }
    const p = AiFindingSchema.safeParse(raw);
    if (!p.success) {
      rejected.push({ ...tag, reason: 'schema' });
      continue;
    }
    const a = p.data;
    const loc = locateQuote(g, a.quote);
    if (!loc) {
      rejected.push({ candidate_id: a.candidate_id, reason: 'quote_not_found' });
      continue;
    }
    const block = g.structure.blocks[loc.blockIndex]!;
    const text = block.lines.map((l) => l.text).join(' ');
    const snap = snapToSentence(text, loc.start, loc.end);
    // mask BEFORE hashing (R2): the stored/hashed sentence never carries raw account digits
    const masked = mask(snap.quote, sensitiveSpans(snap.quote));
    if (masked.length === 0) {
      rejected.push({ candidate_id: a.candidate_id, reason: 'quote_not_found' });
      continue;
    }
    const qh = quoteHash(masked);
    const anchor = makeAnchor(block.anchor.docHash, block.id, snap.start, snap.end);
    const id = findingId(detectorId, a.issue_class, anchor, qh);
    if (seen.has(id)) continue;
    const f: Finding = {
      id,
      issue_class: a.issue_class,
      severity: capSeverity(a.severity, maxSeverityFor(a.issue_class, 'ai')),
      detector_kind: 'ai',
      detector_id: detectorId,
      model: ctx.model,
      provenance: ctx.provenance,
      confidence: a.confidence,
      anchor,
      section_path: block.section_path,
      quote: masked,
      quote_snippet: snippet(masked),
      quote_hash: qh,
      detail: {
        explanation: clampText(maskText(a.explanation), 1000),
        facts: {
          source: AI_SUGGESTION_LABEL,
          candidate_id: a.candidate_id,
          model: ctx.model,
          task,
        },
        interpretations: (a.interpretations ?? []).map((x) => clampText(maskText(x), 500)),
      },
    };
    const page = block.lines[0]?.page;
    if (page) f.page = page;
    const ok = FindingSchema.safeParse(f);
    if (!ok.success) {
      rejected.push({ candidate_id: a.candidate_id, reason: 'invalid_finding' });
      continue;
    }
    seen.add(id);
    findings.push(ok.data);
  }
  return { ok: true, findings, rejected };
}
