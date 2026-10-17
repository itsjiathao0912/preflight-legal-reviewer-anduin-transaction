import { limits } from '../config/limits';
import { makeAnchor } from '../model/anchors';
import type { DocGraph } from '../graph/graph';
import type { Line, Region } from '../model/types';
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

/** Clamp to the schema bound so a long input degrades to "…" instead of a ZodError (F1). */
function clamp(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
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
    explanation: clamp(input.explanation, 1000),
    facts: Object.fromEntries(
      Object.entries(input.facts).map(([k, v]) => [k, typeof v === 'string' ? clamp(v, 1000) : v]),
    ),
    interpretations: (input.interpretations ?? [])
      .filter((x) => x.length > 0)
      .slice(0, 6)
      .map((x) => clamp(x, 500)),
  };
  if (input.expected) detail.expected = clamp(input.expected, 300);
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
  const region = evidenceRegion(block.lines, input.matchStart);
  if (region) f.region = region;
  return FindingSchema.parse(f);
}

/** The whole page, in the normalized 0..1 page coordinates used by OCR / PDF regions. */
const WHOLE_PAGE: Region = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Finding region (Phase 06 D3): the region of the evidence line (the line that contains
 * `matchStart` in the space-joined block text); the whole page when only the page is known;
 * none for HTML (no page, no region), so HTML findings are unchanged.
 */
export function evidenceRegion(lines: readonly Line[], matchStart: number): Region | undefined {
  let pos = 0;
  let hit = lines[lines.length - 1];
  for (const l of lines) {
    if (matchStart < pos + l.text.length + 1) {
      hit = l;
      break;
    }
    pos += l.text.length + 1;
  }
  if (!hit) return undefined;
  if (hit.region) return { ...hit.region };
  return (hit.page ?? lines[0]?.page) !== undefined ? { ...WHOLE_PAGE } : undefined;
}

/** pattern_key spec: single implementation in memory/patternKey.ts (byte-identical for existing keys). */
export { patternKey } from '../memory/patternKey';
