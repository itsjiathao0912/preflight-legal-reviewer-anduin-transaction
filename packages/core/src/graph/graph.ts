import type { Doc, GraphEdge, GraphNode, LogicGraph } from '../model/types';
import type { Structure } from '../structure/types';

/** Stable node ids. */
export const nodeId = {
  section: (scopeId: string, number: string) => `sec:${scopeId}:${number}`,
  part: (scopeId: string, number: string, letter: string) => `part:${scopeId}:${number}:${letter}`,
  block: (blockId: string) => `blk:${blockId}`,
  term: (term: string) => `term:${term}`,
  option: (groupId: string, i: number) => `opt:${groupId}:${i}`,
  field: (fieldId: string) => `fld:${fieldId}`,
};

/** Build the logic graph (nodes: section|part|block|option|term|field; edges: ref|conditional|contains|defines|uses). */
export function buildGraph(s: Structure): LogicGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const addNode = (n: GraphNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  for (const scope of s.scopes) {
    for (const sec of scope.sections) {
      const sid = nodeId.section(scope.id, sec.number);
      addNode({
        id: sid,
        type: 'section',
        label: `${sec.number}. ${sec.title}`,
        anchor: s.blocks[sec.blockIndex]!.anchor,
      });
      for (const p of sec.parts) {
        const pid = nodeId.part(scope.id, sec.number, p.letter);
        addNode({
          id: pid,
          type: 'part',
          label: `Part ${p.letter} – ${p.label}`,
          anchor: s.blocks[p.blockIndex]!.anchor,
        });
        edges.push({ from: sid, to: pid, type: 'contains' });
      }
    }
  }
  s.blocks.forEach((b, i) => {
    const bid = nodeId.block(b.id);
    addNode({ id: bid, type: 'block', label: b.kind, anchor: b.anchor });
    const inf = s.info[i]!;
    if (inf.section) {
      const parent = inf.part
        ? nodeId.part(inf.scope.id, inf.section.number, inf.part.letter)
        : nodeId.section(inf.scope.id, inf.section.number);
      edges.push({ from: parent, to: bid, type: 'contains' });
    }
  });
  for (const r of s.references) {
    if (r.ref.kind !== 'internal' || !r.ref.target) continue;
    const t = r.ref.target;
    const to = t.part
      ? nodeId.part(t.scopeId, t.sectionNumber, t.part)
      : nodeId.section(t.scopeId, t.sectionNumber);
    const fallback = nodeId.section(t.scopeId, t.sectionNumber);
    const target = seen.has(to) ? to : seen.has(fallback) ? fallback : undefined;
    if (!target) continue;
    edges.push({
      from: nodeId.block(s.blocks[r.blockIndex]!.id),
      to: target,
      type: 'ref',
      meta: { refId: r.ref.id, status: r.ref.status },
    });
  }
  for (const c of s.conditionals) {
    for (const target of c.targets) {
      edges.push({
        from: nodeId.block(s.blocks[c.blockIndex]!.id),
        to: `target:${target}`,
        type: 'conditional',
        meta: { id: c.id, action: c.action, negative: c.negative },
      });
    }
  }
  const defined = new Set<string>();
  for (const t of s.definedTerms) {
    addNode({ id: nodeId.term(t.term), type: 'term', label: t.term });
    edges.push({
      from: nodeId.block(s.blocks[t.blockIndex]!.id),
      to: nodeId.term(t.term),
      type: 'defines',
    });
    defined.add(t.term);
  }
  // uses: first block using each defined term outside its definition (bounded: one edge per block+term)
  for (const term of defined) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    s.blocks.forEach((b) => {
      if (re.test(b.lines.map((l) => l.text).join(' ')))
        edges.push({ from: nodeId.block(b.id), to: nodeId.term(term), type: 'uses' });
    });
  }
  for (const g of s.optionGroups) {
    g.options.forEach((o, i) => {
      addNode({ id: nodeId.option(g.id, i), type: 'option', label: o.label.slice(0, 120) });
      edges.push({
        from: nodeId.block(s.blocks[o.blockIndex]!.id),
        to: nodeId.option(g.id, i),
        type: 'contains',
        meta: { group: g.id, exclusive: g.exclusive },
      });
    });
  }
  for (const f of s.fields) {
    addNode({ id: nodeId.field(f.id), type: 'field', label: f.label });
    edges.push({
      from: nodeId.block(s.blocks[f.blockIndex]!.id),
      to: nodeId.field(f.id),
      type: 'contains',
    });
  }
  return { nodes, edges };
}

/** Doc + structure + graph: the detector input. */
export interface DocGraph {
  doc: Doc;
  structure: Structure;
  graph: LogicGraph;
}
