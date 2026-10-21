import type { OptionRow, StructureView } from '@aduin/core';
import { sectionOf } from '../../investor-paths/InvestorTypesLens';

/** One real defect on the form path: a broken conditional, a suspicious reference or a dead end. */
export interface FlowBreak {
  id: string;
  kind: 'condition' | 'crossref' | 'dead-end';
  label: string;
  /** Tag text and the existing tag style. */
  tag: 'Blocks' | 'Fix';
  where: string;
  section: string | null;
  findingId: string | null;
  blockId: string;
}

export interface FlowStep {
  number: string;
  title: string;
  blockId: string | null;
  /** The selected type's own questions/instructions in this section. */
  typeQuestions: string[];
  /** Document-wide option groups in this section (shown muted, after the type's own lines). */
  questions: OptionRow[];
  breaks: FlowBreak[];
  /** True when this type has a question here that at least one other type does not. */
  onlyType: boolean;
  /** Breaks at this step that apply to other types only: "Applies to <label> only". */
  appliesTo: string[];
}

/** A run of plain steps collapsed into one row, or one step. */
export type FlowItem = { kind: 'step'; step: FlowStep } | { kind: 'run'; steps: FlowStep[] };

export interface FlowPath {
  steps: FlowStep[];
  /** null when the document has no investor types (all sections are listed). */
  reaches: boolean | null;
  /** Breaks that sit outside the sections of this path. */
  other: FlowBreak[];
}

/** Subject of a conditional ("If the Investor is a Benefit Plan Investor," -> "benefit plan investor"). */
function conditionSubject(condition: string): string | null {
  const m = /\bis an? (.+)$/i.exec(condition);
  const subject = m?.[1]
    ?.toLowerCase()
    .replace(/[\s.,;:!?]+$/, '')
    .trim();
  return subject || null;
}

/** Investor types a conditional targets (empty when it targets none of them = applies to all). */
function conditionTypes(v: StructureView, condition: string): StructureView['investors']['types'] {
  const subject = conditionSubject(condition);
  if (!subject) return [];
  return v.investors.types.filter((t) => t.label.toLowerCase().includes(subject));
}

function globalBreaks(v: StructureView): FlowBreak[] {
  const out: FlowBreak[] = [];
  for (const c of v.conditions) {
    if (!c.issue) continue;
    out.push({
      id: c.id,
      kind: 'condition',
      label: c.targetFound
        ? `Condition “${c.condition}” needs a check`
        : `Branch to ${c.target} goes nowhere`,
      tag: 'Blocks',
      where: c.where,
      section: sectionOf(c.where),
      findingId: c.findingId,
      blockId: c.blockId,
    });
  }
  for (const r of v.crossrefs) {
    if (!r.issue) continue;
    out.push({
      id: r.id,
      kind: 'crossref',
      label:
        r.status === 'unresolved'
          ? `“${r.text}” points to nothing`
          : `“${r.text}” points to the wrong part`,
      tag: r.status === 'unresolved' ? 'Blocks' : 'Fix',
      where: r.where,
      section: sectionOf(r.where),
      findingId: r.findingId,
      blockId: r.blockId,
    });
  }
  return out;
}

function deadEnds(gaps: StructureView['investors']['types'][number]['gaps']): FlowBreak[] {
  return gaps
    .filter((g) => g.kind === 'dead-end')
    .map((g) => ({
      id: g.id,
      kind: 'dead-end' as const,
      label: `No route to the signature: ${g.item}`,
      tag: 'Blocks' as const,
      where: g.where,
      section: sectionOf(g.where),
      findingId: g.findingId,
      blockId: g.blockId,
    }));
}

/**
 * Every real break in the form flow (Form flow count). Option groups whose answer cue was only
 * inferred are not breaks. Dead ends shared by several investor types count once.
 */
export function flowBreaks(v: StructureView): FlowBreak[] {
  const out = globalBreaks(v);
  const seen = new Set<string>();
  for (const t of v.investors.types)
    for (const b of deadEnds(t.gaps)) {
      const k = `${b.blockId}|${b.label}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(b);
    }
  return out;
}

/**
 * True when an investor type cannot reach the signature: the engine says so, or a broken
 * conditional branch ("If the Investor is a Benefit Plan Investor, ...") targets this type.
 */
export function typeStuck(
  v: StructureView,
  t: StructureView['investors']['types'][number],
): boolean {
  if (t.reachesCompletion === false) return true;
  const label = t.label.toLowerCase();
  return v.conditions.some((c) => {
    if (!c.issue || c.targetFound) return false;
    const subject = conditionSubject(c.condition);
    return !!subject && label.includes(subject);
  });
}

/** The steps one investor type walks through, with its own questions and breaks inline. */
export function flowPath(v: StructureView, type: string | null): FlowPath {
  const types = v.investors.types;
  const current = types.find((t) => t.type === type) ?? types[0];
  const top = v.sections.filter((s) => s.depth === 0);
  const list = current ? current.sections : top.map((s) => ({ number: s.number, title: s.title }));
  const all = [...globalBreaks(v), ...(current ? deadEnds(current.gaps) : [])];
  // A broken conditional aimed at specific types is a break only for those types.
  const elsewhere = new Map<string, string>();
  const breaks = all.filter((b) => {
    if (b.kind !== 'condition' || !current) return true;
    const c = v.conditions.find((x) => x.id === b.id);
    const targets = c ? conditionTypes(v, c.condition) : [];
    if (!targets.length || targets.some((t) => t.type === current.type)) return true;
    elsewhere.set(b.id, targets.map((t) => t.label).join(', '));
    return false;
  });
  const placed = new Set<string>();
  const steps: FlowStep[] = list.map((s) => {
    const at = breaks.filter((b) => b.section === s.number);
    for (const b of at) placed.add(b.id);
    const own = current ? current.questions.filter((q) => q.section === s.number).map((q) => q.text) : [];
    const onlyType = own.some((text) =>
      types.some(
        (o) => o !== current && !o.questions.some((q) => q.section === s.number && q.text === text),
      ),
    );
    const appliesTo = all
      .filter((b) => elsewhere.has(b.id) && b.section === s.number)
      .map((b) => elsewhere.get(b.id)!);
    for (const b of all) if (elsewhere.has(b.id) && b.section === s.number) placed.add(b.id);
    return {
      number: s.number,
      title: s.title,
      blockId: top.find((x) => x.number === s.number)?.blockId ?? null,
      typeQuestions: own,
      questions: v.options.filter((o) => sectionOf(o.where) === s.number),
      breaks: at,
      onlyType,
      appliesTo: [...new Set(appliesTo)],
    };
  });
  return {
    steps,
    reaches: current ? !typeStuck(v, current) : null,
    other: breaks.filter((b) => !placed.has(b.id)),
  };
}

/** A step worth its own row: type-specific lines, a break, or another type's break note. */
function notable(s: FlowStep): boolean {
  return s.typeQuestions.length > 0 || s.breaks.length > 0 || s.onlyType || s.appliesTo.length > 0;
}

/** Collapses consecutive plain steps (2 or more) into one "same for every type" run. */
export function flowItems(steps: FlowStep[]): FlowItem[] {
  const out: FlowItem[] = [];
  let run: FlowStep[] = [];
  const flush = () => {
    if (run.length === 1) out.push({ kind: 'step', step: run[0]! });
    else if (run.length) out.push({ kind: 'run', steps: run });
    run = [];
  };
  for (const s of steps) {
    if (notable(s)) {
      flush();
      out.push({ kind: 'step', step: s });
    } else run.push(s);
  }
  flush();
  return out;
}

/** "Sections 2–5 · same for every type". */
export function runLabel(steps: FlowStep[]): string {
  return `Sections ${steps[0]!.number}–${steps[steps.length - 1]!.number} · same for every type`;
}

/** "Question: Investor type · one answer · 6 options". */
export function questionLine(o: OptionRow): string {
  const n = o.options.length;
  return `Question: ${o.question} · ${o.howMany === 'one' ? 'one answer' : 'several answers'} · ${n} ${
    n === 1 ? 'option' : 'options'
  }`;
}
