import type { DocGraph } from '../graph/graph';
import { buildFinding, patternKey } from '../findings/make-finding';
import type { Finding } from '../findings/schema';
import type { DefinedTerm } from '../structure/types';
import type { Detector, ExplainFacts } from './registry';
import { fact, maskFacts, textOf, whereOf } from './util';

/**
 * defined-term-issues (rules ported from defined-terms-checker, MIT; own implementation + tests):
 *  - duplicate (high): the same term defined twice for different things in one numbering scope
 *  - used-before-defined (medium): the term is used earlier in the same scope than its definition
 *  - unused (medium): the term is defined but never used
 *  - capitalization (medium): a multi-word term appears with inconsistent capitals
 * "Used but undefined" is the Phase 01 `undefined-term` rule (offering security) and is not
 * repeated here. Structural false-positive filters only (no sample- or term-keyed lists):
 *  - re-definition in another numbering scope (instructions vs terms vs signature pages)
 *  - re-definition with the same referent ("…Act of 1974, as amended (“ERISA”)" twice)
 *  - a quoted label right after "Section N" is a heading citation, not a definition
 *  - abbreviation-like terms (all capitals or containing a period, <= 6 chars) are not "unused"
 *  - a term defined in the last block of its scope (closing definition) is not "used before defined"
 *  - "used before defined" only for inline (parenthetical) definitions outside appendix/terms scopes;
 *    a use inside a longer capitalized name ("… Private Markets Fund", "Medalist REIT, Inc.") or
 *    followed by an explicit forward reference ("as defined below") is not an early use
 */
export const DEFINED_TERM_ISSUES_ID = 'defined-term-issues';
export type TermIssueKind = 'duplicate' | 'used-before-defined' | 'unused' | 'capitalization';

const SEVERITY: Record<TermIssueKind, 'high' | 'medium'> = {
  duplicate: 'high',
  'used-before-defined': 'medium',
  unused: 'medium',
  capitalization: 'medium',
};

export const SECTION_LABEL_BEFORE_RE = /\bSection\s{1,3}\d{1,2}[A-Z]?\s{0,3}\(?\s{0,2}$/;
export const ABBREVIATION_RE = /^(?:[A-Z&]{1,6}|[A-Za-z.]{1,6}\.)$/;
const STOP = new Set([
  'the',
  'a',
  'an',
  'as',
  'amended',
  'inc',
  'llc',
  'l',
  'p',
  'lp',
  'co',
  'corp',
  'ltd',
]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Last <= 3 content words before the definition's opening parenthesis / quote (normalized). */
export function referentOf(text: string, defStart: number): string {
  const before = text.slice(Math.max(0, defStart - 80), defStart).toLowerCase();
  const words = before.match(/[a-z0-9]+/g) ?? [];
  return words
    .filter((w) => !STOP.has(w))
    .slice(-3)
    .join(' ');
}

export const FORWARD_REF_RE =
  /^[\s”"’)]{0,3}\(?\s{0,2}(?:as defined|as hereinafter defined|defined below|hereinafter)/i;
export const CAP_WORD_BEFORE_RE = /(?:^|[^.;:!?]\s)([A-Z][A-Za-z&'’-]{0,30})[,]?\s{1,2}$/;
/** Capitalized function words (sentence starts) never make a use part of a proper name. */
const FUNCTION_WORDS = new Set([
  'The',
  'A',
  'An',
  'This',
  'That',
  'Such',
  'Each',
  'Any',
  'Every',
  'No',
  'If',
  'When',
  'Our',
  'Your',
  'Its',
  'All',
]);
export const CAP_WORD_AFTER_RE = /^,?\s{1,2}(?:[A-Z][A-Za-z&'’-]{0,30}|Inc\.|LLC|L\.P\.)/;

/** A use that is not part of a longer capitalized name and not an explicit forward reference. */
export function isStandaloneUse(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 34), start);
  const after = text.slice(end, end + 34);
  if (FORWARD_REF_RE.test(after)) return false;
  if (CAP_WORD_AFTER_RE.test(after)) return false;
  const cap = CAP_WORD_BEFORE_RE.exec(before);
  if (start > 0 && cap && !FUNCTION_WORDS.has(cap[1]!)) return false;
  return true;
}

function isLabelCitation(g: DocGraph, d: DefinedTerm): boolean {
  return SECTION_LABEL_BEFORE_RE.test(
    textOf(g, d.blockIndex).slice(Math.max(0, d.start - 24), d.start + 1),
  );
}

interface Issue {
  kind: TermIssueKind;
  term: string;
  def: DefinedTerm;
  /** Anchor of the evidence (second definition / early use / variant use / definition). */
  blockIndex: number;
  start: number;
  end: number;
  detail: string;
}

const WORD_RE = /[A-Za-z0-9_]+/g;

/**
 * F4 (bounded scan): word index built once per document, so each term only scans the blocks that
 * contain its first word (exact case for uses, lowercase for capitalization variants) instead of
 * every block. `\bTerm\b` can only match where the term's first \w-run is a whole word, so the
 * results are identical to the full scan.
 */
export interface WordIndex {
  exact: Map<string, number[]>;
  lower: Map<string, number[]>;
}

export function buildWordIndex(texts: readonly string[]): WordIndex {
  const exact = new Map<string, number[]>();
  const lower = new Map<string, number[]>();
  texts.forEach((t, i) => {
    for (const m of t.matchAll(WORD_RE)) {
      const w = m[0];
      const e = exact.get(w);
      if (!e) exact.set(w, [i]);
      else if (e[e.length - 1] !== i) e.push(i);
      const lw = w.toLowerCase();
      const l = lower.get(lw);
      if (!l) lower.set(lw, [i]);
      else if (l[l.length - 1] !== i) l.push(i);
    }
  });
  return { exact, lower };
}

/** Ascending block indices that can hold the term (null = term has no leading word; scan all). */
export function candidateBlocks(
  idx: WordIndex,
  term: string,
  caseInsensitive: boolean,
): number[] | null {
  const m = /^[A-Za-z0-9_]+/.exec(term);
  if (!m) return null;
  return (caseInsensitive ? idx.lower.get(m[0].toLowerCase()) : idx.exact.get(m[0])) ?? [];
}

/** Optional instrumentation for the bounded-scan gate. */
export interface TermScanStats {
  blocksScanned: number;
}

export function termIssues(g: DocGraph, stats?: TermScanStats): Issue[] {
  const s = g.structure;
  const defs = s.definedTerms.filter((d) => !isLabelCitation(g, d));
  const byTerm = new Map<string, DefinedTerm[]>();
  for (const d of defs) {
    const l = byTerm.get(d.term);
    if (l) l.push(d);
    else byTerm.set(d.term, [d]);
  }
  const texts = s.blocks.map((_, i) => textOf(g, i));
  const idx = buildWordIndex(texts);
  const all = texts.map((_, i) => i);
  const scan = (blocks: number[]) => {
    if (stats) stats.blocksScanned += blocks.length;
    return blocks;
  };
  const issues: Issue[] = [];
  for (const [term, list] of [...byTerm.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const first = list[0]!;
    const scopeOf = (d: DefinedTerm) => s.info[d.blockIndex]!.scope.id;
    // duplicate: same scope, different referent
    const firstRef = referentOf(texts[first.blockIndex]!, first.start);
    const dup = list
      .slice(1)
      .find(
        (d) =>
          scopeOf(d) === scopeOf(first) && referentOf(texts[d.blockIndex]!, d.start) !== firstRef,
      );
    if (dup) {
      issues.push({
        kind: 'duplicate',
        term,
        def: first,
        blockIndex: dup.blockIndex,
        start: dup.start,
        end: dup.end,
        detail: `defined again in ${whereOf(g, dup.blockIndex)}`,
      });
    }
    const re = new RegExp(`\\b${escapeRe(term)}\\b`, 'g');
    // used-before-defined: earliest exact use in the same scope before the first definition
    const scope = s.info[first.blockIndex]!.scope;
    const lastOfScope = s.scopes[s.scopes.indexOf(scope) + 1]?.startBlock ?? s.blocks.length;
    const inlineDef = first.form === 'paren' && scope.kind !== 'appendix' && scope.kind !== 'terms';
    const exactBlocks = candidateBlocks(idx, term, false) ?? all;
    if (inlineDef && first.blockIndex < lastOfScope - 1) {
      const early = exactBlocks.filter((i) => i >= scope.startBlock && i < first.blockIndex);
      for (const i of scan(early)) {
        if (s.blocks[i]!.kind === 'heading') continue;
        let m: RegExpExecArray | null = null;
        for (const x of texts[i]!.matchAll(re)) {
          if (isStandaloneUse(texts[i]!, x.index!, x.index! + x[0].length)) {
            m = x as RegExpExecArray;
            break;
          }
        }
        if (m) {
          issues.push({
            kind: 'used-before-defined',
            term,
            def: first,
            blockIndex: i,
            start: m.index,
            end: m.index + m[0].length,
            detail: `first used in ${whereOf(g, i)}, defined later in ${whereOf(g, first.blockIndex)}`,
          });
          break;
        }
      }
    }
    // unused: no use outside the definition spans
    if (!ABBREVIATION_RE.test(term)) {
      let used = false;
      for (const i of scan(exactBlocks)) {
        if (used) break;
        re.lastIndex = 0;
        for (const m of texts[i]!.matchAll(re)) {
          const inDef = list.some(
            (d) => d.blockIndex === i && m.index! >= d.start && m.index! < d.end,
          );
          if (!inDef) {
            used = true;
            break;
          }
        }
      }
      if (!used)
        issues.push({
          kind: 'unused',
          term,
          def: first,
          blockIndex: first.blockIndex,
          start: first.start,
          end: first.end,
          detail: `defined in ${whereOf(g, first.blockIndex)} and never used`,
        });
    }
    // capitalization: multi-word term with a mixed-case variant (not all lower, not all caps)
    if (/\s/.test(term)) {
      const ci = new RegExp(`\\b${escapeRe(term)}\\b`, 'gi');
      let hit: Issue | undefined;
      for (const i of scan(candidateBlocks(idx, term, true) ?? all)) {
        if (hit) break;
        for (const m of texts[i]!.matchAll(ci)) {
          const v = m[0];
          if (v === term || v === v.toLowerCase() || v === v.toUpperCase()) continue;
          if (!/^[A-Z]/.test(v)) continue;
          hit = {
            kind: 'capitalization',
            term,
            def: first,
            blockIndex: i,
            start: m.index!,
            end: m.index! + v.length,
            detail: `written "${v}" in ${whereOf(g, i)}`,
          };
          break;
        }
      }
      if (hit) issues.push(hit);
    }
  }
  return issues;
}

function explain(f: ExplainFacts): string {
  const term = fact(f, 'term', 'the term');
  switch (f.kind) {
    case 'duplicate':
      return `"${term}" is defined twice with different wording: first in ${fact(f, 'defined_at', 'the document')}, then ${fact(f, 'detail', 'again')}.`;
    case 'used-before-defined':
      return `"${term}" is ${fact(f, 'detail', 'used before its definition')}.`;
    case 'unused':
      return `"${term}" is ${fact(f, 'detail', 'defined but never used')}.`;
    case 'capitalization':
      return `"${term}" is ${fact(f, 'detail', 'written with different capitals')}; a defined term should be written exactly as defined.`;
    default:
      return `"${term}" has a defined-term issue (${fact(f, 'kind', 'unknown')}) in ${fact(f, 'defined_at', 'the document')}.`;
  }
}

const EXPECTED: Record<TermIssueKind, (t: string) => string> = {
  duplicate: (t) => `One definition of "${t}"`,
  'used-before-defined': (t) => `"${t}" defined before (or where) it is first used`,
  unused: (t) => `Remove the definition of "${t}" or use the term`,
  capitalization: (t) => `"${t}" written exactly as defined`,
};

export const definedTermIssues: Detector = {
  id: DEFINED_TERM_ISSUES_ID,
  class: 'defined_term_issue',
  severity: 'high',
  explain,
  patternKey: (f) => patternKey(DEFINED_TERM_ISSUES_ID, String(f.kind ?? 'issue')),
  run(g: DocGraph): Finding[] {
    return termIssues(g).map((it) => {
      const facts = maskFacts({
        kind: it.kind,
        term: it.term,
        defined_at: whereOf(g, it.def.blockIndex),
        detail: it.detail,
      });
      return buildFinding(g, {
        detectorId: DEFINED_TERM_ISSUES_ID,
        issueClass: 'defined_term_issue',
        severity: SEVERITY[it.kind],
        confidence: it.kind === 'duplicate' ? 0.8 : 0.6,
        blockIndex: it.blockIndex,
        matchStart: it.start,
        matchEnd: it.end,
        explanation: explain(facts),
        facts,
        interpretations: [
          `The drafting is inconsistent and "${String(facts.term)}" should be fixed.`,
          `The wording is intentional; no change is needed.`,
        ],
        expected: maskFacts({ e: EXPECTED[it.kind](it.term) }).e as string,
        patternKey: definedTermIssues.patternKey(facts),
      });
    });
  },
};
