import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { maskToken, sensitiveSpans, type Span } from '../memory/mask';
import type { Detector, ExplainFacts } from './registry';
import { fact, groupBySentence, maskFacts, textOf, whereOf } from './util';

/**
 * flag-sensitive (AC10): bank account / routing numbers that follow a cue word (ABA, routing,
 * DDA, account) in the same block. Facts carry only the masked last 4 (`#1234`), the cue and the
 * kind; the raw value never reaches facts, explanation, quote, snippet or quote_hash.
 * Severity is capped at medium (DATA-MODEL: last-4 collisions never hide a blocking item).
 * Two numbers in one sentence (sample #7 "ABA#: … DDA#: …") become ONE finding listing both.
 */
export const FLAG_SENSITIVE_ID = 'flag-sensitive';
export const SENSITIVE_KINDS = ['aba', 'dda', 'routing', 'account', 'other'] as const;
export type SensitiveKind = (typeof SENSITIVE_KINDS)[number];

/** Look-back window (chars) before a candidate number in which the cue must sit. */
export const CUE_WINDOW = 32;
export const CUE_WORD_RE = /\b(ABA|[Rr]outing|ROUTING|DDA|[Aa]ccount|ACCOUNT)\b/g;
/** Text allowed between the cue word and the number: punctuation plus "number", "no.", "#". */
export const CUE_GAP_RE =
  /^[\s#:.()–-]{0,6}(?:(?:[Nn]umber|NUMBER|[Nn]o\.?|[Rr]outing|[Tt]ransit)[\s#:.()–-]{0,6}){0,2}$/;
export const ABA_ROUTING_RE = /\bABA\s{0,3}[Rr]outing[\s#:.()–-]{0,6}$/;

export function kindOf(cue: string): SensitiveKind {
  const c = cue.toLowerCase();
  if (c === 'aba') return 'aba';
  if (c === 'dda') return 'dda';
  if (c === 'routing') return 'routing';
  if (c === 'account') return 'account';
  return 'other';
}

export interface SensitiveHit {
  span: Span;
  cue: string;
  kind: SensitiveKind;
  last4: string;
}

/** Cue-bearing candidate numbers in one block text (pure). */
export function sensitiveHits(text: string): SensitiveHit[] {
  const out: SensitiveHit[] = [];
  for (const span of sensitiveSpans(text)) {
    const from = Math.max(0, span.start - CUE_WINDOW);
    const window = text.slice(from, span.start);
    let last: RegExpMatchArray | undefined;
    for (const m of window.matchAll(CUE_WORD_RE)) last = m;
    if (!last) continue;
    const gap = window.slice(last.index! + last[0].length);
    if (!CUE_GAP_RE.test(gap)) continue;
    const abaRouting = ABA_ROUTING_RE.test(window);
    const cueText = abaRouting
      ? window.slice(window.search(/\bABA\b/)).replace(/[\s#:.()–-]+$/, '')
      : last[0] +
        gap
          .replace(/[\s:.()–-]+$/, '')
          .replace(/^\s+/, ' ')
          .trimEnd();
    out.push({
      span,
      cue: cueText.replace(/\s+/g, ' ').trim(),
      kind: abaRouting ? 'aba' : kindOf(last[1]!),
      last4: maskToken(text.slice(span.start, span.end)),
    });
  }
  return out;
}

function explain(f: ExplainFacts): string {
  return `A bank number (${fact(f, 'kind', 'account')}) ending ${fact(f, 'last4', '#????')} follows the cue "${fact(f, 'cue', 'account')}" in ${fact(f, 'where', 'the document')}. It is masked by default; confirm it is correct and meant to appear in this form.`;
}

export const flagSensitive: Detector = {
  id: FLAG_SENSITIVE_ID,
  class: 'sensitive_data',
  severity: 'medium',
  explain,
  patternKey: (f) =>
    patternKey(
      FLAG_SENSITIVE_ID,
      String(f.kind ?? 'other')
        .split(/,\s*/)
        .join('-'),
    ),
  run(g: DocGraph): Finding[] {
    const hits: Array<{ blockIndex: number; start: number; end: number; item: SensitiveHit }> = [];
    g.structure.blocks.forEach((_, bi) => {
      for (const h of sensitiveHits(textOf(g, bi))) {
        hits.push({ blockIndex: bi, start: h.span.start, end: h.span.end, item: h });
      }
    });
    return groupBySentence(g, hits).map((h) => {
      const kinds: string[] = [];
      for (const x of h.items) if (!kinds.includes(x.kind)) kinds.push(x.kind);
      const facts = maskFacts({
        last4: h.items.map((x) => x.last4).join(', '),
        cue: h.items.map((x) => x.cue).join(', '),
        kind: kinds.join(', '),
        where: whereOf(g, h.blockIndex),
        count: h.items.length,
      });
      return buildFinding(g, {
        detectorId: FLAG_SENSITIVE_ID,
        issueClass: 'sensitive_data',
        severity: 'medium',
        confidence: 0.8,
        blockIndex: h.blockIndex,
        matchStart: h.matchStart,
        matchEnd: h.matchEnd,
        explanation: explain(facts),
        facts,
        expected: 'Confirm the account details are correct for this form (kept masked)',
        patternKey: flagSensitive.patternKey(facts),
        sensitive: h.items.map((x) => x.span),
      });
    });
  },
};
