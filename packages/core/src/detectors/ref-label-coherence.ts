import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import { labelOf } from '../structure/headings';
import type { RefInfo, Scope } from '../structure/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, refRoutingContext, refSeverity } from './util';

/**
 * L. ref-label-coherence (AC12): "<noun window> indicated|specified|set forth|described in
 * Part X of Section N" where the noun window does not fit the cited target but fits another one.
 * Initial values (pinned; final values recorded in the Phase 01 report).
 */
export const LABEL_COHERENCE = Object.freeze({
  windowTokens: 4,
  stopwords: Object.freeze([
    'to',
    'the',
    'of',
    'in',
    'for',
    'as',
    'a',
    'an',
    'and',
    'or',
    'with',
    'by',
  ]),
  citedMax: 0.25,
  expectedMin: 0.5,
  confidence: 0.7,
});
export const REF_LABEL_COHERENCE_ID = 'ref-label-coherence';

const STOP = new Set<string>(LABEL_COHERENCE.stopwords);
const VERB_TAIL_RE = /\b(indicated|specified|set forth|described)\s+in\s*$/;

/** Singular fold for token comparison. */
export function fold(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 3 && token.endsWith('s') && !/(ss|us|is)$/.test(token))
    return token.slice(0, -1);
  return token;
}

/** Token pipeline: strip non-alphanumerics (E3), lowercase, drop empties and stopwords, singular-fold. */
export function cleanTokens(raw: string[]): string[] {
  return raw
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .filter((t) => t.length > 0 && !STOP.has(t))
    .map(fold);
}

/** Noun window: last 4 RAW tokens before the verb, THEN stopword strip (order pinned, L.3). */
export function nounWindow(textBeforeVerb: string): string[] {
  const raw = textBeforeVerb.trim().split(/\s+/).filter(Boolean);
  return [...new Set(cleanTokens(raw.slice(-LABEL_COHERENCE.windowTokens)))];
}

export function labelTokens(label: string): string[] {
  return [...new Set(cleanTokens(label.split(/\s+/)))];
}

export function overlap(window: string[], label: string[]): number {
  if (window.length === 0) return 0;
  const set = new Set(label);
  let hit = 0;
  for (const t of window) if (set.has(t)) hit++;
  return hit / window.length;
}

export interface LabelTarget {
  sectionNumber: string;
  part?: string;
  label: string;
  display: string;
}

function targetsOf(scope: Scope): LabelTarget[] {
  const out: LabelTarget[] = [];
  for (const s of scope.sections) {
    const title = labelOf(s.title);
    out.push({ sectionNumber: s.number, label: title, display: `Section ${s.number} (${title})` });
    for (const p of s.parts) {
      out.push({
        sectionNumber: s.number,
        part: p.letter,
        label: p.label,
        display: `Section ${s.number} Part ${p.letter} (${p.label})`,
      });
    }
  }
  return out;
}

export interface LabelScore {
  window: string[];
  cited: LabelTarget | undefined;
  p: number;
  best: LabelTarget | undefined;
  t: number;
  fire: boolean;
  /** Offset of the first noun-window token in the block text. */
  windowStart: number;
}

function blockText(g: DocGraph, i: number): string {
  return g.structure.blocks[i]!.lines.map((l) => l.text).join(' ');
}

/** Score one L-form reference (exported for golden explain-fact assertions). */
export function scoreReference(g: DocGraph, r: RefInfo): LabelScore | null {
  if (r.form !== 'part_of_section' || !r.verb || !r.ref.target) return null;
  const scope = g.structure.scopes.find((s) => s.id === r.ref.target!.scopeId);
  if (!scope) return null;
  const before = blockText(g, r.blockIndex).slice(0, r.start);
  const verbAt = before.search(VERB_TAIL_RE);
  const head = verbAt >= 0 ? before.slice(0, verbAt) : before;
  const window = nounWindow(head);
  // offset of the 4th-last raw token (for the quote focus)
  let windowStart = head.length;
  let count = 0;
  for (let i = head.length - 1; i >= 0 && count < LABEL_COHERENCE.windowTokens; i--) {
    if (!/\s/.test(head[i]!) && (i === 0 || /\s/.test(head[i - 1]!))) {
      count++;
      windowStart = i;
    }
  }
  const targets = targetsOf(scope);
  const sec = targets.find((t) => t.sectionNumber === r.sectionNumber && t.part === undefined);
  const citedPart = targets.find((t) => t.sectionNumber === r.sectionNumber && t.part === r.part);
  // cited section without that Part -> the cited label is the section title
  const cited = citedPart ?? sec;
  const p = cited ? overlap(window, labelTokens(cited.label)) : 0;
  let best: LabelTarget | undefined;
  let t = 0;
  for (const cand of targets) {
    if (cand === cited) continue;
    const o = overlap(window, labelTokens(cand.label));
    if (o > t) {
      t = o;
      best = cand;
    }
  }
  const fire = p < LABEL_COHERENCE.citedMax && t >= LABEL_COHERENCE.expectedMin;
  return { window, cited, p, best, t, fire, windowStart };
}

function explain(f: ExplainFacts): string {
  return `"${fact(f, 'noun_window', 'the cited words')}" is said to be in ${fact(f, 'reference', 'the cited target')}, but that target is "${fact(f, 'cited_label', '(missing)')}"; it fits ${fact(f, 'expected_target', 'another target')} better.`;
}

export const refLabelCoherence: Detector = {
  id: REF_LABEL_COHERENCE_ID,
  class: 'broken_cross_reference',
  // maximum: critical in a routing context (instructions / answer option / conditional), else high
  severity: 'critical',
  explain,
  patternKey: (f) =>
    patternKey(REF_LABEL_COHERENCE_ID, `part-${String(f.cited_part ?? 'x')}-of-section`),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    for (const r of g.structure.references) {
      const s = scoreReference(g, r);
      if (!s || !s.fire || !s.best) continue;
      const ctx = refRoutingContext(g, r.blockIndex);
      const facts: ExplainFacts = {
        reference: r.ref.text,
        noun_window: s.window.join(' '),
        cited_part: r.part ?? null,
        cited_section: r.sectionNumber ?? null,
        cited_label: s.cited?.label ?? '(missing)',
        cited_overlap: Number(s.p.toFixed(2)),
        expected_target: s.best.display,
        expected_label: s.best.label,
        expected_overlap: Number(s.t.toFixed(2)),
        routing_context: ctx ?? 'none',
      };
      r.ref.status = 'suspicious';
      r.ref.expected = { sectionNumber: s.best.sectionNumber, label: s.best.label };
      if (s.best.part) r.ref.expected.part = s.best.part;
      out.push(
        buildFinding(g, {
          detectorId: REF_LABEL_COHERENCE_ID,
          issueClass: 'broken_cross_reference',
          severity: refSeverity(ctx),
          confidence: LABEL_COHERENCE.confidence,
          blockIndex: r.blockIndex,
          matchStart: s.windowStart,
          matchEnd: r.end,
          explanation: explain(facts),
          facts,
          expected: s.best.display,
          patternKey: refLabelCoherence.patternKey(facts),
        }),
      );
    }
    return out;
  },
};
