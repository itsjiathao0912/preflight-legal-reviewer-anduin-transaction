import { checkTarget, conditionalTargets } from '../detectors/flow';
import { maskText, maskThenClip, whereOf } from '../detectors/util';
import { sensitiveSpans } from '../memory/mask';
import type { DocGraph } from '../graph/graph';
import type { Finding } from '../findings/schema';
import { investorModelOf } from '../investor/paths';
import { TYPE_LABELS, type InvestorTypeId } from '../investor/types';
import type { Conditional, OptionGroup, Section, Structure } from '../structure/types';

/**
 * Structure view model (AC17 / AC61): plain, structured-clone-safe data for the `#structure`
 * screen, built ONLY inside the engine worker. Six lenses with rows and an `issue` flag per row
 * ("Structure issue" = a row a deterministic rule flags: suspicious or unresolved reference,
 * condition with an unclear target, option group with an inferred cue or a range/footnote
 * finding, defined-term problem, investor-type gap or dead end). Every document-derived string is
 * masked. `badge` = total issues (the sidebar count), computed from the same rows.
 */
export const LENS_IDS = [
  'sections',
  'crossrefs',
  'conditions',
  'options',
  'terms',
  'investors',
] as const;
export type LensId = (typeof LENS_IDS)[number];

export interface SectionRow {
  id: string;
  number: string;
  title: string;
  /** 0 = section, 1 = part. */
  depth: 0 | 1;
  restart: boolean;
  numbering: string;
  refsIn: number;
  refsOut: number;
  /** References leaving this section that are suspicious or unresolved. */
  flags: number;
  blockId: string;
}

export type RefStatus = 'resolved' | 'suspicious' | 'unresolved';
export interface CrossrefRow {
  id: string;
  text: string;
  where: string;
  target: string;
  status: RefStatus;
  quote: string;
  expected: string | null;
  findingId: string | null;
  issue: boolean;
  blockId: string;
}

export interface ExternalRow {
  id: string;
  text: string;
  where: string;
  source: string;
  blockId: string;
}

export type ConditionKind = 'whitelist' | 'role' | 'skip' | 'negative' | 'jump';
export interface ConditionRow {
  id: string;
  kind: ConditionKind;
  text: string;
  where: string;
  condition: string;
  target: string;
  targetFound: boolean;
  findingId: string | null;
  issue: boolean;
  blockId: string;
}

export interface OptionRow {
  id: string;
  question: string;
  where: string;
  options: string[];
  howMany: 'one' | 'all';
  cueStated: boolean;
  cueText: string | null;
  findingId: string | null;
  issue: boolean;
  blockId: string;
}

export type TermStatus = 'ok' | 'early' | 'twice' | 'none' | 'unused' | 'case';
export interface TermRow {
  id: string;
  term: string;
  definedAt: string;
  uses: number;
  status: TermStatus;
  note: string;
  findingId: string | null;
  issue: boolean;
  blockId: string | null;
}

export interface InvestorGapRow {
  id: string;
  kind: 'part-c' | 'peer-item' | 'dead-end';
  item: string;
  clause: string;
  where: string;
  peers: string[];
  findingId: string | null;
  blockId: string;
}

export interface InvestorTypeRow {
  type: string;
  label: string;
  sections: Array<{ number: string; title: string }>;
  skipped: Array<{ number: string; title: string }>;
  questions: Array<{ section: string; text: string }>;
  reachesCompletion: boolean;
  uncertain: boolean;
  gaps: InvestorGapRow[];
}

export interface InvestorView {
  types: InvestorTypeRow[];
  completion: string | null;
  /** Type pre-selected in the view (app.html: Partnership or LLC when present). */
  preselected: string | null;
  sectionTotal: number;
}

export interface StructureView {
  version: 1;
  badge: number;
  counts: Record<LensId, number>;
  totals: Record<LensId, number>;
  sectionCount: number;
  referenceCount: number;
  sections: SectionRow[];
  crossrefs: CrossrefRow[];
  external: ExternalRow[];
  conditions: ConditionRow[];
  options: OptionRow[];
  terms: TermRow[];
  investors: InvestorView;
}

const TERM_KIND: Record<string, TermStatus> = {
  duplicate: 'twice',
  'used-before-defined': 'early',
  unused: 'unused',
  capitalization: 'case',
};

const TERM_NOTE: Record<TermStatus, string> = {
  ok: 'Defined once.',
  early: 'Used before its definition.',
  twice: 'Defined twice with different wording.',
  none: 'Used but not defined.',
  unused: 'Defined but never used.',
  case: 'Written with different capitals.',
};

function blockTextOf(s: Structure, i: number): string {
  return s.blocks[i]!.lines.map((l) => l.text).join(' ');
}

/**
 * Excerpt around [start, end): word-bounded, with "…" where the text was cut. The window is first
 * widened so it never cuts through a sensitive span, then the cut text is masked (F2: a cut can
 * never leave a raw digit tail that is too short to be recognised and masked).
 */
function excerpt(text: string, start: number, end: number, pad = 90): string {
  let a = Math.max(0, start - pad);
  let b = Math.min(text.length, end + pad);
  for (const sp of sensitiveSpans(text)) {
    if (sp.start < a && sp.end > a) a = sp.start;
    if (sp.start < b && sp.end > b) b = sp.end;
  }
  if (a > 0) {
    const sp = text.indexOf(' ', a);
    if (sp !== -1 && sp < start) a = sp + 1;
  }
  if (b < text.length) {
    const sp = text.lastIndexOf(' ', b);
    if (sp > end) b = sp;
  }
  return `${a > 0 ? '…' : ''}${maskText(text.slice(a, b).trim())}${b < text.length ? '…' : ''}`;
}

function sectionKey(scopeId: string, number: string): string {
  return `${scopeId}:${number}`;
}

function numberingOf(
  s: Structure,
  sec: Section,
  next: number,
): { restart: boolean; numbering: string } {
  if (sec.parts.length) {
    const letters = sec.parts.map((p) => p.letter);
    return {
      restart: true,
      numbering:
        letters.length > 1
          ? `Parts ${letters[0]} to ${letters.at(-1)}, restart inside this section`
          : `Part ${letters[0]}, scoped to this section`,
    };
  }
  const items: string[] = [];
  for (let i = sec.blockIndex + 1; i < next; i++) {
    const n = s.info[i]?.listNumber;
    if (n && s.blocks[i]!.kind === 'list_item') items.push(n);
  }
  if (items.length && items[0] === '1')
    return { restart: true, numbering: `Paragraphs 1 to ${items.at(-1)}, restart in this section` };
  return { restart: false, numbering: items.length ? `Items ${items.join(', ')}` : 'Unnumbered' };
}

function conditionKind(c: Conditional): ConditionKind {
  if (c.role) return 'role';
  if (c.action === 'skip') return 'skip';
  if (c.negative) return 'negative';
  if (c.action === 'proceed') return 'jump';
  return 'whitelist';
}

function questionOf(s: Structure, g: OptionGroup): string {
  const first = g.blockIndices[0]!;
  for (let i = first - 1; i >= Math.max(0, first - 2); i--) {
    const b = s.blocks[i]!;
    if (b.kind === 'option') break;
    const t = blockTextOf(s, i).trim();
    if (t && t.length <= 120) return t.replace(/:\s*$/, '');
  }
  return g.options[0] ? maskThenClip(g.options[0].label, 80) : 'Options';
}

/** Pure: the same graph and findings always give the same view (AC8 determinism). */
export function buildStructureView(g: DocGraph, findings: readonly Finding[]): StructureView {
  const s = g.structure;
  const m = (t: string) => maskText(t);
  const byBlock = new Map<string, Finding[]>();
  for (const f of findings)
    byBlock.set(f.anchor.blockId, [...(byBlock.get(f.anchor.blockId) ?? []), f]);
  const findingOn = (blockIndex: number, pred: (f: Finding) => boolean): Finding | undefined =>
    (byBlock.get(s.blocks[blockIndex]!.id) ?? []).find(pred);

  // ---- references
  const crossrefs: CrossrefRow[] = [];
  const external: ExternalRow[] = [];
  const refsIn = new Map<string, number>();
  const refsOut = new Map<string, number>();
  const flagsOut = new Map<string, number>();
  for (const r of s.references) {
    const where = whereOf(g, r.blockIndex);
    const blockId = s.blocks[r.blockIndex]!.id;
    if (r.ref.kind !== 'internal') {
      external.push({
        id: `x:${r.ref.id}`,
        text: m(r.ref.text),
        where: m(where),
        source:
          r.form === 'usc_cfr'
            ? 'U.S. Code / C.F.R.'
            : r.rule
              ? 'Statute or rule outside this document'
              : 'Outside this document',
        blockId,
      });
      continue;
    }
    const info = s.info[r.blockIndex]!;
    const t = r.ref.target;
    if (info.section) {
      const k = sectionKey(info.scope.id, info.section.number);
      refsOut.set(k, (refsOut.get(k) ?? 0) + 1);
      if (r.ref.status !== 'resolved') flagsOut.set(k, (flagsOut.get(k) ?? 0) + 1);
    }
    if (t)
      refsIn.set(
        sectionKey(t.scopeId, t.sectionNumber),
        (refsIn.get(sectionKey(t.scopeId, t.sectionNumber)) ?? 0) + 1,
      );
    let target = 'Not found in the document';
    if (t) {
      const sec = s.scopes
        .find((x) => x.id === t.scopeId)
        ?.sections.find((x) => x.number === t.sectionNumber);
      const title = sec ? ` (${maskThenClip(sec.title.replace(/\s*\(.*$/, ''), 60)})` : '';
      target = `Section ${t.sectionNumber}${t.part ? `, Part ${t.part}` : ''}${title}`;
    }
    const f = findingOn(
      r.blockIndex,
      (x) => x.issue_class === 'broken_cross_reference' && x.quote.includes(r.ref.text),
    );
    const exp = r.ref.expected;
    crossrefs.push({
      id: `r:${r.ref.id}`,
      text: m(r.ref.text),
      where: m(where),
      target: m(target),
      status: r.ref.status,
      quote: m(excerpt(blockTextOf(s, r.blockIndex), r.start, r.end)),
      expected: exp
        ? m(`Section ${exp.sectionNumber}${exp.part ? ` Part ${exp.part}` : ''} (${exp.label})`)
        : null,
      findingId: f?.id ?? null,
      issue: r.ref.status !== 'resolved',
      blockId,
    });
  }

  // ---- sections
  const sections: SectionRow[] = [];
  for (const scope of s.scopes) {
    scope.sections.forEach((sec, i) => {
      const next = scope.sections[i + 1]?.blockIndex ?? s.blocks.length;
      const k = sectionKey(scope.id, sec.number);
      const num = numberingOf(s, sec, next);
      const scopeRestart =
        i === 0 &&
        scope.ordinal > 0 &&
        s.scopes.slice(0, scope.ordinal).some((x) => x.sections.length > 0);
      sections.push({
        id: `s:${k}`,
        number: sec.number,
        title: maskThenClip(sec.title, 120),
        depth: 0,
        restart: num.restart || scopeRestart,
        numbering:
          scopeRestart && !num.restart
            ? 'Numbering starts again in this part of the document'
            : num.numbering,
        refsIn: refsIn.get(k) ?? 0,
        refsOut: refsOut.get(k) ?? 0,
        flags: flagsOut.get(k) ?? 0,
        blockId: s.blocks[sec.blockIndex]!.id,
      });
      for (const p of sec.parts) {
        sections.push({
          id: `s:${k}:${p.letter}`,
          number: p.letter,
          title: maskThenClip(p.label, 120),
          depth: 1,
          restart: false,
          numbering: `Part letter, scoped to Section ${sec.number}`,
          refsIn: 0,
          refsOut: 0,
          flags: 0,
          blockId: s.blocks[p.blockIndex]!.id,
        });
      }
    });
  }

  // ---- conditions
  const conditions: ConditionRow[] = s.conditionals.map((c) => {
    const checks = conditionalTargets(g, c).map((t) => checkTarget(g, c, t));
    const targetFound = checks.every((x) => x.status !== 'missing');
    const f = findingOn(
      c.blockIndex,
      (x) =>
        x.issue_class === 'broken_conditional' || x.issue_class === 'unreachable_or_circular_flow',
    );
    return {
      id: `c:${c.id}`,
      kind: conditionKind(c),
      text: maskThenClip(c.text, 240),
      where: m(whereOf(g, c.blockIndex)),
      condition: maskThenClip(c.trigger.replace(/[,\s]+$/, ''), 160),
      target: m(c.targets.join(', ')),
      targetFound,
      findingId: f?.id ?? null,
      issue: !targetFound || f !== undefined,
      blockId: s.blocks[c.blockIndex]!.id,
    };
  });

  // ---- option groups
  const options: OptionRow[] = s.optionGroups.map((og) => {
    const f = og.blockIndices
      .map((bi) =>
        findingOn(
          bi,
          (x) =>
            x.issue_class === 'option_gap_overlap' ||
            x.issue_class === 'inconsistent_footnote_requirement',
        ),
      )
      .find((x) => x !== undefined);
    const cueStated = og.cue !== undefined;
    return {
      id: `o:${og.id}`,
      question: maskThenClip(questionOf(s, og), 120),
      where: m(whereOf(g, og.blockIndices[0]!)),
      options: og.options.map((o) => maskThenClip(o.label, 80)),
      howMany: og.cue && /all that apply/i.test(og.cue) ? 'all' : 'one',
      cueStated,
      cueText: og.cue ? m(og.cue) : null,
      findingId: f?.id ?? null,
      issue: !cueStated || f !== undefined,
      blockId: s.blocks[og.blockIndices[0]!]!.id,
    };
  });

  // ---- defined terms
  const terms: TermRow[] = [];
  const seenTerm = new Set<string>();
  const usesOf = (term: string) =>
    g.graph.edges.filter((e) => e.type === 'uses' && e.to === `term:${term}`).length;
  for (const d of s.definedTerms) {
    if (seenTerm.has(d.term)) continue;
    seenTerm.add(d.term);
    const f = findings.find(
      (x) => x.detector_id === 'defined-term-issues' && x.detail.facts.term === d.term,
    );
    const status: TermStatus = f ? (TERM_KIND[String(f.detail.facts.kind)] ?? 'ok') : 'ok';
    terms.push({
      id: m(`t:${d.term}`),
      term: m(d.term),
      definedAt: m(whereOf(g, d.blockIndex)),
      uses: usesOf(d.term),
      status,
      note: f ? f.detail.explanation : TERM_NOTE.ok,
      findingId: f?.id ?? null,
      issue: status !== 'ok',
      blockId: s.blocks[d.blockIndex]!.id,
    });
  }
  for (const f of findings) {
    if (f.detector_id !== 'undefined-term') continue;
    const term = String(f.detail.facts.used_term ?? '');
    if (!term || seenTerm.has(term)) continue;
    seenTerm.add(term);
    terms.push({
      id: m(`t:${term}`),
      term: m(term),
      definedAt: 'Not defined',
      uses: Number(f.detail.facts.contexts ?? 1) || 1,
      status: 'none',
      note: f.detail.explanation,
      findingId: f.id,
      issue: true,
      blockId: f.anchor.blockId,
    });
  }

  // ---- investor types
  const model = investorModelOf(g);
  const mainTitle = (n: string) => {
    for (const sc of s.scopes) {
      const sec = sc.sections.find((x) => x.number === n);
      if (sec) return maskThenClip(sec.title.replace(/\s*\(.*$/, ''), 80);
    }
    return '';
  };
  const typeRows: InvestorTypeRow[] = model.paths.map((p) => {
    const gaps: InvestorGapRow[] = p.gaps.map((gap, i) => {
      const f = findingOn(
        gap.citation.blockIndex,
        (x) => x.issue_class === 'investor_path_missing_item',
      );
      return {
        id: `pq:${p.type}:${i}`,
        kind: gap.kind,
        item: m(gap.item),
        clause: m(gap.citation.text),
        where: m(whereOf(g, gap.citation.blockIndex)),
        peers: gap.peers.map((x) => TYPE_LABELS[x]),
        findingId: f?.id ?? null,
        blockId: s.blocks[gap.citation.blockIndex]!.id,
      };
    });
    if (p.deadEnd) {
      const c = p.deadEnd.citation;
      const f = findingOn(c.blockIndex, (x) => x.issue_class === 'investor_path_dead_end');
      gaps.push({
        id: `pq:${p.type}:dead-end`,
        kind: 'dead-end',
        item: m(p.deadEnd.reason),
        clause: m(c.text),
        where: m(whereOf(g, c.blockIndex)),
        peers: [],
        findingId: f?.id ?? null,
        blockId: s.blocks[c.blockIndex]!.id,
      });
    }
    return {
      type: p.type,
      label: m(p.label),
      sections: p.sections.map((n) => ({ number: n, title: mainTitle(n) })),
      skipped: p.skipped.map((n) => ({ number: n, title: mainTitle(n) })),
      questions: p.questions.map((q) => ({ section: q.section, text: m(q.text) })),
      reachesCompletion: p.reachesCompletion,
      uncertain: p.uncertain,
      gaps,
    };
  });
  const has = (t: InvestorTypeId) => typeRows.some((r) => r.type === t);
  const preselected = has('partnership')
    ? 'partnership'
    : (typeRows.find((r) => r.gaps.length)?.type ?? typeRows[0]?.type ?? null);
  const investors: InvestorView = {
    types: typeRows,
    completion: model.completion ? m(model.completion) : null,
    preselected,
    sectionTotal: typeRows[0] ? typeRows[0].sections.length + typeRows[0].skipped.length : 0,
  };

  const counts: Record<LensId, number> = {
    sections: 0,
    crossrefs: crossrefs.filter((r) => r.issue).length,
    conditions: conditions.filter((r) => r.issue).length,
    options: options.filter((r) => r.issue).length,
    terms: terms.filter((r) => r.issue).length,
    investors: typeRows.reduce((a, r) => a + r.gaps.length, 0),
  };
  const totals: Record<LensId, number> = {
    sections: sections.length,
    crossrefs: crossrefs.length,
    conditions: conditions.length,
    options: options.length,
    terms: terms.length,
    investors: typeRows.length,
  };
  return {
    version: 1,
    badge: counts.crossrefs + counts.conditions + counts.options + counts.terms + counts.investors,
    counts,
    totals,
    sectionCount: s.scopes.reduce((a, x) => a + x.sections.length, 0),
    referenceCount: s.references.length,
    sections,
    crossrefs,
    external,
    conditions,
    options,
    terms,
    investors,
  };
}
