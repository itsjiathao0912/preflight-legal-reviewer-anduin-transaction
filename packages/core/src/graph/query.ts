import type { LogicGraph } from '../model/types';
import type { Scope, Section, Structure } from '../structure/types';

export function sectionsOf(s: Structure): Array<{ scope: Scope; section: Section }> {
  const out: Array<{ scope: Scope; section: Section }> = [];
  for (const scope of s.scopes) for (const section of scope.sections) out.push({ scope, section });
  return out;
}

export function blockText(s: Structure, blockIndex: number): string {
  return s.blocks[blockIndex]!.lines.map((l) => l.text).join(' ');
}

export function nodesOfType(g: LogicGraph, type: LogicGraph['nodes'][number]['type']) {
  return g.nodes.filter((n) => n.type === type);
}

export function edgesOfType(g: LogicGraph, type: LogicGraph['edges'][number]['type']) {
  return g.edges.filter((e) => e.type === type);
}

export function outgoing(g: LogicGraph, from: string) {
  return g.edges.filter((e) => e.from === from);
}
