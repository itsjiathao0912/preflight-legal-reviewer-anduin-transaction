import type { Structure } from '../structure/types';
import type { Unit } from './align';
import { blockText } from './align';
import { excerptOf } from './diff-text';
import { sentenceRanges } from './extract-requirements';
import { foldTerm } from './normalize-key';
import { renameNorm } from './rename-inference';
import type { DefinitionDiff, Rename } from './types';

/** Defined terms reuse the structurer's `definedTerms` (first definition of each term wins). */
export interface TermDef {
  term: string;
  unit: Unit;
  text: string;
  start: number;
  end: number;
}

export function termDefs(
  s: Structure,
  unitOfBlock: readonly number[],
  units: readonly Unit[],
): TermDef[] {
  const out: TermDef[] = [];
  const seen = new Set<string>();
  for (const d of s.definedTerms) {
    if (seen.has(d.term)) continue;
    const ui = unitOfBlock[d.blockIndex];
    if (ui === undefined) continue;
    seen.add(d.term);
    const text = blockText(s, d.blockIndex);
    const r = sentenceRanges(text).find((x) => x.start <= d.start && x.end >= d.start) ?? {
      start: d.start,
      end: d.end,
    };
    out.push({ term: d.term, unit: units[ui]!, text, start: r.start, end: r.end });
  }
  return out;
}

/** Definitions delta: added / removed / changed (rename-aware wording) / renamed (D3 renames). */
export function diffDefinitions(
  defsA: readonly TermDef[],
  defsB: readonly TermDef[],
  renames: readonly Rename[],
): DefinitionDiff[] {
  const byB = new Map(defsB.map((d) => [d.term, d] as const));
  const byA = new Map(defsA.map((d) => [d.term, d] as const));
  const sentence = (d: TermDef) => d.text.slice(d.start, d.end);
  const ex = (d: TermDef) => excerptOf(d.text, d.start, d.end, 0);
  const out: DefinitionDiff[] = [];
  const renamedTargets = new Set<string>();
  for (const d of defsA) {
    const b = byB.get(d.term);
    if (b) {
      if (renameNorm(sentence(d), renames, 'a') !== renameNorm(sentence(b), renames, 'b'))
        out.push({
          term: d.term,
          status: 'changed',
          pathA: d.unit.path,
          pathB: b.unit.path,
          a: ex(d),
          b: ex(b),
        });
      continue;
    }
    const r = renames.find((x) => foldTerm(x.from) === foldTerm(d.term));
    const target = r && defsB.find((x) => !byA.has(x.term) && foldTerm(x.term) === foldTerm(r.to));
    if (target) {
      renamedTargets.add(target.term);
      out.push({
        term: d.term,
        status: 'renamed',
        termB: target.term,
        pathA: d.unit.path,
        pathB: target.unit.path,
        a: ex(d),
        b: ex(target),
      });
    } else out.push({ term: d.term, status: 'removed', pathA: d.unit.path, a: ex(d) });
  }
  for (const d of defsB) {
    if (byA.has(d.term) || renamedTargets.has(d.term)) continue;
    out.push({ term: d.term, status: 'added', pathB: d.unit.path, b: ex(d) });
  }
  return out;
}
