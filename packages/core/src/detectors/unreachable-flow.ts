import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { Conditional } from '../structure/types';
import { checkTarget, conditionalTargets, sectionOfBlock } from './flow';
import type { Detector, ExplainFacts } from './registry';
import { fact, maskFacts, maskThenClip, textOf, whereOf } from './util';

/**
 * unreachable-flow (critical): reachability + cycle detection over jump instructions
 * ("proceed to / go to Section N").
 *  - circular: the jump edges between sections form a cycle (A jumps to B, B jumps back to A).
 *  - unreachable: a jump that applies to everyone ("All subscribers proceed to Section 6") skips
 *    sections that no other instruction or reference ever routes to.
 * Only proven graph facts produce findings; anything unparsed is ignored (never asserted).
 */
export const UNREACHABLE_FLOW_ID = 'unreachable-flow';
export const UNIVERSAL_TRIGGER_RE = /\b(?:all|every|each|any)\b/i;

export interface JumpEdge {
  from: string;
  to: string;
  cond: Conditional;
}

/** Jump edges between existing sections of the same numbering scope. */
export function jumpEdges(g: DocGraph): JumpEdge[] {
  const out: JumpEdge[] = [];
  for (const c of g.structure.conditionals) {
    if (c.action !== 'proceed') continue;
    const from = sectionOfBlock(g, c.blockIndex);
    if (!from) continue;
    for (const t of conditionalTargets(g, c)) {
      if (!t.section || t.parts.length) continue;
      if (checkTarget(g, c, t).status !== 'ok') continue;
      out.push({ from, to: t.section, cond: c });
    }
  }
  return out;
}

/** First cycle in the jump graph, as the ordered list of edges (deterministic DFS). */
export function findCycle(edges: JumpEdge[]): JumpEdge[] | null {
  const adj = new Map<string, JumpEdge[]>();
  for (const e of edges) {
    const list = adj.get(e.from);
    if (list) list.push(e);
    else adj.set(e.from, [e]);
  }
  const nodes = [...adj.keys()].sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10) || (a < b ? -1 : 1),
  );
  const state = new Map<string, 1 | 2>();
  const stack: JumpEdge[] = [];
  const visit = (n: string): JumpEdge[] | null => {
    state.set(n, 1);
    for (const e of adj.get(n) ?? []) {
      stack.push(e);
      const s = state.get(e.to);
      if (s === 1) {
        const i = stack.findIndex((x) => x.from === e.to);
        return stack.slice(i);
      }
      if (s === undefined) {
        const r = visit(e.to);
        if (r) return r;
      }
      stack.pop();
    }
    state.set(n, 2);
    return null;
  };
  for (const n of nodes) {
    if (state.has(n)) continue;
    const r = visit(n);
    if (r) return r;
  }
  return null;
}

function explain(f: ExplainFacts): string {
  if (f.kind === 'circular')
    return `The jump instructions form a loop: ${fact(f, 'path', 'a section path')}. A reader who meets these conditions never reaches the end of the form (starting at "${fact(f, 'instruction', 'the instruction')}" in ${fact(f, 'where', 'the document')}).`;
  return `"${fact(f, 'instruction', 'The instruction')}" in ${fact(f, 'where', 'the document')} sends every reader past ${fact(f, 'skipped', 'some sections')}, and no other instruction or reference leads there, so ${fact(f, 'skipped', 'those sections')} can never be reached.`;
}

export const unreachableFlow: Detector = {
  id: UNREACHABLE_FLOW_ID,
  class: 'unreachable_or_circular_flow',
  severity: 'critical',
  explain,
  patternKey: (f) => patternKey(UNREACHABLE_FLOW_ID, String(f.kind ?? 'unreachable')),
  run(g: DocGraph): Finding[] {
    const out: Finding[] = [];
    const edges = jumpEdges(g);
    const emit = (c: Conditional, facts: ExplainFacts, expected: string) => {
      const m = maskFacts(facts);
      const text = textOf(g, c.blockIndex);
      out.push(
        buildFinding(g, {
          detectorId: UNREACHABLE_FLOW_ID,
          issueClass: 'unreachable_or_circular_flow',
          severity: 'critical',
          confidence: 0.8,
          blockIndex: c.blockIndex,
          matchStart: Math.min(c.start, text.length),
          matchEnd: Math.min(c.end, text.length),
          explanation: explain(m),
          facts: m,
          expected,
          patternKey: unreachableFlow.patternKey(m),
        }),
      );
    };
    const cycle = findCycle(edges);
    if (cycle) {
      const first = cycle[0]!;
      emit(
        first.cond,
        {
          kind: 'circular',
          instruction: maskThenClip(first.cond.text, 200),
          path: [...cycle.map((e) => `Section ${e.from}`), `Section ${first.from}`].join(' → '),
          where: whereOf(g, first.cond.blockIndex),
        },
        'Every path through the form reaches the signature pages',
      );
    }
    // universal forward jumps that strand sections
    const routed = new Set<string>();
    for (const c of g.structure.conditionals)
      for (const t of conditionalTargets(g, c)) if (t.section) routed.add(t.section);
    for (const r of g.structure.references)
      if (r.ref.kind === 'internal' && r.ref.target) routed.add(r.ref.target.sectionNumber);
    for (const e of edges) {
      if (!UNIVERSAL_TRIGGER_RE.test(e.cond.trigger)) continue;
      const scope = g.structure.info[e.cond.blockIndex]!.scope;
      const fromNum = parseInt(e.from, 10);
      const toNum = parseInt(e.to, 10);
      if (!(toNum > fromNum + 1)) continue;
      const stranded = scope.sections
        .filter((s) => s.num > fromNum && s.num < toNum && !routed.has(s.number))
        .map((s) => s.number);
      if (!stranded.length) continue;
      emit(
        e.cond,
        {
          kind: 'unreachable',
          instruction: maskThenClip(e.cond.text, 200),
          skipped: stranded.map((n) => `Section ${n}`).join(', '),
          target: `Section ${e.to}`,
          where: whereOf(g, e.cond.blockIndex),
        },
        `A route that reaches ${stranded.map((n) => `Section ${n}`).join(', ')}`,
      );
    }
    return out;
  },
};
