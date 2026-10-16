import { limits } from '../config/limits';
import { makeAnchor } from '../model/anchors';
import type { DocGraph } from '../graph/graph';
import { mask, sensitiveSpans, type Span } from '../memory/mask';
import { quoteHash } from '../memory/fingerprint';
import { snapToSentence } from '../memory/snap';
import { findingId } from './ids';
import { FindingSchema, type Finding, type FindingDetail } from './schema';
import { capSeverity, maxSeverityFor, type Severity } from './severity';
import type { IssueClass } from './taxonomy';

export interface FindingInput {
  detectorId: string;
  issueClass: IssueClass;
  severity: Severity;
  confidence: number;
  blockIndex: number;
  matchStart: number;
  matchEnd: number;
  explanation: string;
  facts: FindingDetail['facts'];
  interpretations?: string[];
  expected?: string;
  patternKey?: string;
  /** Sensitive spans relative to the block text (masked before hashing). */
  sensitive?: Span[];
}

function snippetOf(quote: string, focusStart: number, focusEnd: number): string {
  const max = limits.snippetMaxChars;
  if (quote.length <= max) return quote;
  const centre = Math.floor((focusStart + focusEnd) / 2);
  let s = Math.max(0, centre - Math.floor((max - 2) / 2));
  const e = Math.min(quote.length, s + max - 2);
  s = Math.max(0, e - (max - 2));
  return (s > 0 ? '…' : '') + quote.slice(s, e).trim() + (e < quote.length ? '…' : '');
}

/** Build a schema-valid rule finding: sentence snap, mask, quote_hash, stable id, severity cap. */
export function buildFinding(g: DocGraph, input: FindingInput): Finding {
  const block = g.structure.blocks[input.blockIndex]!;
  const text = block.lines.map((l) => l.text).join(' ');
  const snap = snapToSentence(text, input.matchStart, input.matchEnd);
  const spans = (input.sensitive ?? [])
    .map((s) => ({ start: s.start - snap.start, end: s.end - snap.start }))
    .filter((s) => s.end > 0 && s.start < snap.quote.length)
    // default-on masking: account/routing-like digit runs in the quote are always masked (F2)
    .concat(sensitiveSpans(snap.quote));
  const masked = mask(snap.quote, spans);
  const qh = quoteHash(masked);
  const anchor = makeAnchor(block.anchor.docHash, block.id, snap.start, snap.end);
  const severity = capSeverity(input.severity, maxSeverityFor(input.issueClass, 'rule'));
  const detail: FindingDetail = {
    explanation: input.explanation,
    facts: input.facts,
    interpretations: input.interpretations ?? [],
  };
  if (input.expected) detail.expected = input.expected;
  const f: Finding = {
    id: findingId(input.detectorId, input.issueClass, anchor, qh),
    issue_class: input.issueClass,
    severity,
    detector_kind: 'rule',
    detector_id: input.detectorId,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    anchor,
    section_path: block.section_path,
    quote: masked,
    quote_snippet: snippetOf(masked, input.matchStart - snap.start, input.matchEnd - snap.start),
    quote_hash: qh,
    detail,
  };
  if (input.patternKey) f.pattern_key = input.patternKey;
  const page = block.lines[0]?.page;
  if (page) f.page = page;
  return FindingSchema.parse(f);
}

/** pattern_key spec: single implementation in memory/patternKey.ts (byte-identical for existing keys). */
export { patternKey } from '../memory/patternKey';
